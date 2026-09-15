#!/usr/bin/env bash
set -euo pipefail

# Deploy locally built H5 dist to the loaded test environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env test
#   cd "$H5_LOCAL_PATH"
#   VITE_API_BASE_URL="$H5_API_BASE_URL" VITE_TENANT_ID="$H5_TENANT_ID" pnpm build
#   bash governance/SCRIPTS/deploy-h5-test.sh

required_vars=(H5_SERVER_HOST H5_DEPLOY_USER H5_LOCAL_PATH H5_REMOTE_PATH)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ "${ENV_NAME:-}" != "test" ]]; then
  echo "This script only deploys to test; loaded environment is '${ENV_NAME:-unset}'." >&2
  exit 1
fi

DIST_PATH="$H5_LOCAL_PATH/dist"
if [[ ! -s "$DIST_PATH/index.html" ]]; then
  echo "H5 dist not found: $DIST_PATH/index.html" >&2
  exit 1
fi

RELEASE_DIR="$(mktemp -d /tmp/yshop-h5-release.XXXXXX)"
RELEASE_TAR="$RELEASE_DIR/dist.tar.gz"
trap 'rm -f "$RELEASE_TAR"' EXIT
(cd "$DIST_PATH" && COPYFILE_DISABLE=1 tar czf "$RELEASE_TAR" .)

LOCAL_SHA256="$(shasum -a 256 "$RELEASE_TAR" | cut -d ' ' -f1)"
H5_COMMIT="$(git -C "$H5_LOCAL_PATH" rev-parse HEAD)"
REMOTE_TAR="/tmp/yshop-h5-dist.$H5_COMMIT.tar.gz"
echo "h5_commit=$H5_COMMIT"
echo "h5_tar_sha256=$LOCAL_SHA256"

scp "$RELEASE_TAR" "$H5_DEPLOY_USER@$H5_SERVER_HOST:$REMOTE_TAR"
REMOTE_SHA256="$(ssh "$H5_DEPLOY_USER@$H5_SERVER_HOST" "sha256sum '$REMOTE_TAR'" | cut -d ' ' -f1)"
test "$LOCAL_SHA256" = "$REMOTE_SHA256"

ssh "$H5_DEPLOY_USER@$H5_SERVER_HOST" bash -s -- "$H5_REMOTE_PATH" "$REMOTE_TAR" <<'REMOTE_SCRIPT'
set -euo pipefail
h5_remote_path="$1"
remote_tar="$2"
backup_path="${h5_remote_path}.bak.$(date +%Y%m%d%H%M%S)"
test -s "$remote_tar"
if [[ -d "$h5_remote_path" ]]; then
  mv "$h5_remote_path" "$backup_path"
fi
mkdir -p "$h5_remote_path"
tar xzf "$remote_tar" -C "$h5_remote_path"
test -s "$h5_remote_path/index.html"
nginx -t
systemctl reload nginx
rm -f "$remote_tar"
echo "h5_backup=$backup_path"
REMOTE_SCRIPT

ssh "$H5_DEPLOY_USER@$H5_SERVER_HOST" bash -s -- "$H5_REMOTE_PATH" <<'REMOTE_VERIFY'
set -euo pipefail
h5_remote_path="$1"
test -s "$h5_remote_path/index.html"
test "$(find "$h5_remote_path" -type f | wc -l | tr -d ' ')" -gt 0
systemctl is-active nginx
REMOTE_VERIFY

echo "h5_test_deploy=ok"
