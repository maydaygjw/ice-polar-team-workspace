#!/usr/bin/env bash
set -euo pipefail

# Deploy locally built admin dist to the loaded test environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env test
#   cd "$ADMIN_LOCAL_PATH" && $ADMIN_BUILD_CMD
#   bash governance/SCRIPTS/deploy-admin-test.sh

required_vars=(SERVER_HOST DEPLOY_USER ADMIN_LOCAL_PATH ADMIN_REMOTE_PATH)
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

DIST_PATH="$ADMIN_LOCAL_PATH/dist"
if [[ ! -s "$DIST_PATH/index.html" ]]; then
  echo "Admin dist not found: $DIST_PATH/index.html" >&2
  exit 1
fi

RELEASE_DIR="$(mktemp -d /tmp/yshop-admin-release.XXXXXX)"
RELEASE_TAR="$RELEASE_DIR/dist.tar.gz"
trap 'rm -f "$RELEASE_TAR"' EXIT
(cd "$DIST_PATH" && COPYFILE_DISABLE=1 tar czf "$RELEASE_TAR" .)

LOCAL_SHA256="$(shasum -a 256 "$RELEASE_TAR" | cut -d ' ' -f1)"
ADMIN_COMMIT="$(git -C "$ADMIN_LOCAL_PATH" rev-parse HEAD)"
REMOTE_TAR="/tmp/yshop-admin-dist.$ADMIN_COMMIT.tar.gz"
echo "admin_commit=$ADMIN_COMMIT"
echo "admin_tar_sha256=$LOCAL_SHA256"

scp "$RELEASE_TAR" "$DEPLOY_USER@$SERVER_HOST:$REMOTE_TAR"
REMOTE_SHA256="$(ssh "$DEPLOY_USER@$SERVER_HOST" "sha256sum '$REMOTE_TAR'" | cut -d ' ' -f1)"
test "$LOCAL_SHA256" = "$REMOTE_SHA256"

# Keep remote expansion inside a quoted heredoc; local zsh cannot expand $1 or
# remote variables in this form.
ssh "$DEPLOY_USER@$SERVER_HOST" bash -s -- "$ADMIN_REMOTE_PATH" "$REMOTE_TAR" <<'REMOTE_SCRIPT'
set -euo pipefail
admin_remote_path="$1"
remote_tar="$2"
backup_path="${admin_remote_path}.bak.$(date +%Y%m%d%H%M%S)"
test -s "$remote_tar"
mv "$admin_remote_path" "$backup_path"
mkdir -p "$admin_remote_path"
tar xzf "$remote_tar" -C "$admin_remote_path"
test -s "$admin_remote_path/index.html"
nginx -t
systemctl reload nginx
rm -f "$remote_tar"
echo "admin_backup=$backup_path"
REMOTE_SCRIPT

ssh "$DEPLOY_USER@$SERVER_HOST" bash -s -- "$ADMIN_REMOTE_PATH" <<'REMOTE_VERIFY'
set -euo pipefail
admin_remote_path="$1"
test -s "$admin_remote_path/index.html"
test "$(find "$admin_remote_path" -type f | wc -l | tr -d ' ')" -gt 0
systemctl is-active nginx
REMOTE_VERIFY

echo "admin_test_deploy=ok"
