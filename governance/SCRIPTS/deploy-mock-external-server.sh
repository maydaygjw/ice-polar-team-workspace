#!/usr/bin/env bash
set -euo pipefail

# Pull, install and restart an already provisioned mock-external-server.
# The caller must commit and push the repository before running this script.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   bash governance/SCRIPTS/deploy-mock-external-server.sh

mock_server_host="${MOCK_SERVER_HOST:-rprod18}"
mock_deploy_user="${MOCK_DEPLOY_USER:-root}"
mock_code_path="${MOCK_CODE_PATH:-/opt/holun/mock-external-server}"

script_dir="$(cd "$(dirname "$0")" && pwd)"
bash "${script_dir}/stop-mock-external-server.sh"

ssh "${mock_deploy_user}@${mock_server_host}" "
  set -eu
  target='${mock_code_path}'
  git -C \"\$target\" fetch origin master
  git -C \"\$target\" switch master
  git -C \"\$target\" pull --ff-only origin master
  \"\$target/.venv/bin/python\" -m pip install --no-cache-dir \"\$target\"
  chown -R holun-mock:holun-mock \"\$target\"
  echo deployed_commit=\$(git -C \"\$target\" rev-parse --short HEAD)
"

bash "${script_dir}/start-mock-external-server.sh"
