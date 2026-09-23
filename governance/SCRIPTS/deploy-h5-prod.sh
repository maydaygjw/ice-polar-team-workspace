#!/usr/bin/env bash
set -euo pipefail

# Deploy a locally built H5 dist to the loaded production environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env prod
#   cd "$H5_LOCAL_PATH"
#   VITE_API_BASE_URL="$H5_API_BASE_URL" VITE_TENANT_ID="$H5_TENANT_ID" \
#     VITE_TEST_AUTH_ENABLED=false pnpm build
#   CONFIRM_PROD_H5=YES bash governance/SCRIPTS/deploy-h5-prod.sh

required_vars=(H5_SERVER_HOST H5_DEPLOY_USER H5_LOCAL_PATH H5_REMOTE_PATH H5_API_BASE_URL)
for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    exit 1
  fi
done

if [[ "${ENV_NAME:-}" != "prod" ]]; then
  echo "This script only deploys to production; loaded environment is '${ENV_NAME:-unset}'." >&2
  exit 1
fi

if [[ "${CONFIRM_PROD_H5:-}" != "YES" ]]; then
  echo "Production deployment requires CONFIRM_PROD_H5=YES." >&2
  exit 1
fi

if [[ "$H5_SERVER_HOST" != "yprod1" ]]; then
  echo "Refusing unexpected production host: $H5_SERVER_HOST (expected yprod1)." >&2
  exit 1
fi

if [[ "${H5_TEST_AUTH_ENABLED:-false}" == "true" ]]; then
  echo "Production H5 must not enable VITE_TEST_AUTH_ENABLED." >&2
  exit 1
fi

DIST_PATH="$H5_LOCAL_PATH/dist"
if [[ ! -s "$DIST_PATH/index.html" ]]; then
  echo "H5 dist not found: $DIST_PATH/index.html" >&2
  exit 1
fi

RELEASE_DIR="$(mktemp -d /tmp/yshop-h5-prod-release.XXXXXX)"
RELEASE_TAR="$RELEASE_DIR/dist.tar.gz"
trap 'rm -rf "$RELEASE_DIR"' EXIT
(cd "$DIST_PATH" && COPYFILE_DISABLE=1 tar czf "$RELEASE_TAR" .)

LOCAL_SHA256="$(shasum -a 256 "$RELEASE_TAR" | cut -d ' ' -f1)"
H5_COMMIT="$(git -C "$H5_LOCAL_PATH" rev-parse HEAD)"
REMOTE_TAR="/tmp/yshop-h5-prod.$H5_COMMIT.tar.gz"
echo "h5_host=$H5_SERVER_HOST"
echo "h5_commit=$H5_COMMIT"
echo "h5_tar_sha256=$LOCAL_SHA256"

scp "$RELEASE_TAR" "$H5_DEPLOY_USER@$H5_SERVER_HOST:$REMOTE_TAR"
REMOTE_SHA256="$(ssh "$H5_DEPLOY_USER@$H5_SERVER_HOST" "sha256sum '$REMOTE_TAR'" | cut -d ' ' -f1)"
test "$LOCAL_SHA256" = "$REMOTE_SHA256"

ssh "$H5_DEPLOY_USER@$H5_SERVER_HOST" bash -s -- "$H5_REMOTE_PATH" "$REMOTE_TAR" <<'REMOTE_SCRIPT'
set -euo pipefail
h5_remote_path="$1"
remote_tar="$2"
release_parent="$(dirname "$h5_remote_path")"
backup_path="${h5_remote_path}.bak.$(date +%Y%m%d%H%M%S)"
staging_path="${h5_remote_path}.incoming.$(date +%Y%m%d%H%M%S)"

test -s "$remote_tar"
mkdir -p "$release_parent"
rm -rf "$staging_path"
mkdir -p "$staging_path"
tar xzf "$remote_tar" -C "$staging_path"
test -s "$staging_path/index.html"

if [[ -d "$h5_remote_path" ]]; then
  mv "$h5_remote_path" "$backup_path"
fi
mv "$staging_path" "$h5_remote_path"
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

echo "h5_prod_deploy=ok"
