#!/usr/bin/env bash
set -euo pipefail

# Roll back to a committed mock-external-server revision.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   bash governance/SCRIPTS/rollback-mock-external-server.sh <commit>

known_good_commit="${1:-}"
if [[ ! "$known_good_commit" =~ ^[0-9a-fA-F]{7,40}$ ]]; then
  echo "Usage: $0 <known-good-commit>" >&2
  exit 1
fi

mock_server_host="${MOCK_SERVER_HOST:-rprod18}"
mock_deploy_user="${MOCK_DEPLOY_USER:-root}"
mock_code_path="${MOCK_CODE_PATH:-/opt/holun/mock-external-server}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "${script_dir}/stop-mock-external-server.sh"

ssh "${mock_deploy_user}@${mock_server_host}" "
  set -eu
  target='${mock_code_path}'
  git -C \"\$target\" fetch origin master
  git -C \"\$target\" switch --detach '${known_good_commit}'
  \"\$target/.venv/bin/python\" -m pip install --no-cache-dir \"\$target\"
  chown -R holun-mock:holun-mock \"\$target\"
  echo rollback_commit=\$(git -C \"\$target\" rev-parse --short HEAD)
"

bash "${script_dir}/start-mock-external-server.sh"
