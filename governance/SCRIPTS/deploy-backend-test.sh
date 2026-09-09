#!/usr/bin/env bash
set -euo pipefail

# Build, atomically deploy, health-check, and rollback the yshop test backend.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env test
#   bash governance/SCRIPTS/deploy-backend-test.sh
#
# Set SKIP_BUILD=1 only when reusing an already verified local artifact.

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "${workspace_root}/governance/SCRIPTS/deploy-helper.sh"

if [[ -z "${ENV_NAME:-}" ]]; then
  echo 'Load an environment first: source governance/SCRIPTS/deploy-helper.sh && load_env test' >&2
  exit 1
fi
if [[ "${ENV_NAME}" != "test" ]]; then
  echo 'This script is test-only.' >&2
  exit 1
fi
if [[ "${ALLOW_DIRTY_BUILD:-0}" == "1" ]]; then
  echo 'ALLOW_DIRTY_BUILD=1 is not permitted for deployment.' >&2
  exit 1
fi

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  bash "${workspace_root}/governance/SCRIPTS/build-backend-test.sh"
else
  SKIP_MAVEN_BUILD=1 bash "${workspace_root}/governance/SCRIPTS/build-backend-test.sh"
fi

artifact_path="${workspace_root}/backend/yshop-server/target/${YSHOP_JAR}"
test -s "${artifact_path}"
artifact_commit="$(unzip -p "${artifact_path}" BOOT-INF/classes/git.properties \
  | sed -n 's/^git.commit.id.full=//p' | head -1)"
artifact_sha256="$(shasum -a 256 "${artifact_path}" | cut -d ' ' -f1)"
test -n "${artifact_commit}"
echo "deploying commit=${artifact_commit} sha256=${artifact_sha256}"

ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)
remote_incoming="${YSHOP_START_PATH}/target/.${YSHOP_JAR}.${artifact_commit}.incoming"
health_url="${YSHOP_HEALTH_URL:-http://127.0.0.1:${YSHOP_PORT}/}"

ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
  "${YSHOP_START_PATH}" "${YSHOP_JAR}" "${YSHOP_PORT}" <<'REMOTE'
set -euo pipefail
start_path="$1"
jar_name="$2"
port="$3"
test -s "$start_path/target/$jar_name"
ss -tlnp "( sport = :$port )" | grep -q LISTEN
ps -eo args= | awk -v target="target/$jar_name" \
  '$1 == "java" && $2 == "-jar" && $3 == target { found=1 } END { exit !found }'
REMOTE

cleanup_incoming() {
  ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" \
    "rm -f '${remote_incoming}'" >/dev/null 2>&1 || true
}
trap cleanup_incoming EXIT

wait_for_health() {
  local timeout="$1"
  ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
    "${YSHOP_PORT}" "${health_url}" "${YSHOP_START_PATH}" "${timeout}" <<'REMOTE'
set -euo pipefail
port="$1"
url="$2"
start_path="$3"
timeout="$4"
for i in $(seq 1 "$timeout"); do
  if ss -tlnp "( sport = :$port )" | grep -q LISTEN \
      && curl -fsS --max-time 5 "$url" >/dev/null; then
    echo "healthcheck=ok after ${i}s"
    exit 0
  fi
  sleep 1
done
echo 'Backend did not become healthy.' >&2
tail -200 "$start_path/app.log" >&2 || true
exit 1
REMOTE
}

scp "${artifact_path}" "${DEPLOY_USER}@${SERVER_HOST}:${remote_incoming}" >/dev/null
remote_sha256="$(ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" \
  "sha256sum '${remote_incoming}' | cut -d ' ' -f1")"
if [[ "${artifact_sha256}" != "${remote_sha256}" ]]; then
  echo "Remote SHA-256 mismatch: local=${artifact_sha256}, remote=${remote_sha256}" >&2
  exit 1
fi

backup_path="$(ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
  "${YSHOP_START_PATH}" "${YSHOP_JAR}" <<'REMOTE'
set -euo pipefail
start_path="$1"
jar_name="$2"
backup="$start_path/target/$jar_name.bak.$(date +%Y%m%d%H%M%S)"
if [[ -e "$backup" ]]; then
  backup="$backup.$$"
fi
cp "$start_path/target/$jar_name" "$backup"
printf '%s' "$backup"
REMOTE
)"
echo "backup=${backup_path}"

rollback() {
  local status=$?
  trap - ERR
  echo "Deployment failed; restoring ${backup_path}" >&2
  set +e
  bash "${workspace_root}/governance/SCRIPTS/stop-yshop.sh"
  ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
    "${YSHOP_START_PATH}" "${YSHOP_JAR}" "${backup_path}" <<'REMOTE'
set -euo pipefail
start_path="$1"
jar_name="$2"
backup="$3"
cp "$backup" "$start_path/target/$jar_name"
REMOTE
  bash "${workspace_root}/governance/SCRIPTS/start-yshop.sh"
  wait_for_health 180 || echo 'Rollback health check failed; inspect the remote app log.' >&2
  exit "${status}"
}
trap rollback ERR

bash "${workspace_root}/governance/SCRIPTS/stop-yshop.sh"
ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
  "${YSHOP_START_PATH}" "${YSHOP_JAR}" "${remote_incoming}" "${artifact_commit}" <<'REMOTE'
set -euo pipefail
start_path="$1"
jar_name="$2"
incoming="$3"
commit="$4"
mv "$incoming" "$start_path/target/$jar_name"
unzip -p "$start_path/target/$jar_name" BOOT-INF/classes/git.properties \
  | grep -q "^git.commit.id.full=$commit$"
REMOTE

trap - EXIT
bash "${workspace_root}/governance/SCRIPTS/start-yshop.sh"
wait_for_health 300
ssh "${ssh_args[@]}" "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- \
  "${YSHOP_START_PATH}" "${YSHOP_JAR}" "${artifact_commit}" <<'REMOTE'
set -euo pipefail
start_path="$1"
jar_name="$2"
commit="$3"
ps -eo args= | awk -v target="target/$jar_name" \
  '$1 == "java" && $2 == "-jar" && $3 == target { found=1 } END { exit !found }'
unzip -p "$start_path/target/$jar_name" BOOT-INF/classes/git.properties \
  | grep -q "^git.commit.id.full=$commit$"
REMOTE

echo 'backend deployment succeeded'
