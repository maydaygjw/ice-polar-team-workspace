#!/usr/bin/env bash
set -euo pipefail

# Provision mock-external-server on a new host.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   bash governance/SCRIPTS/provision-mock-external-server.sh

mock_server_host="${MOCK_SERVER_HOST:-rprod18}"
mock_deploy_user="${MOCK_DEPLOY_USER:-root}"
mock_code_path="${MOCK_CODE_PATH:-/opt/holun/mock-external-server}"
mock_repo_url="${MOCK_REPO_URL:-https://gitee.com/icepolar/mock-external-server.git}"
mock_service_name="${MOCK_SERVICE_NAME:-mock-external-server.service}"
mock_port="${MOCK_PORT:-8085}"
mock_callback_allowlist="${MOCK_CALLBACK_ALLOWLIST:-yshop-api.holuntech.com}"

ssh "${mock_deploy_user}@${mock_server_host}" "
  set -eu
  target='${mock_code_path}'
  repo='${mock_repo_url}'

  if ! id -u holun-mock >/dev/null 2>&1; then
    useradd --system --home-dir \"\$target\" --shell /usr/sbin/nologin holun-mock
  fi

  if [ ! -d \"\$target/.git\" ]; then
    if [ -e \"\$target\" ]; then
      mv \"\$target\" \"\$target.bak.\$(date +%Y%m%d%H%M%S)\"
    fi
    git clone --branch master --single-branch \"\$repo\" \"\$target\"
  fi

  if [ ! -x \"\$target/.venv/bin/python\" ]; then
    python3 -m venv \"\$target/.venv\"
  fi
  \"\$target/.venv/bin/python\" -m pip install --no-cache-dir \"\$target\"
  chown -R holun-mock:holun-mock \"\$target\"

  install -d -m 755 /etc/holun
  printf '%s\\n' \\
    'MOCK_ENV=production' \\
    'MOCK_RUNTIME_ENABLED=true' \\
    'MOCK_ADMIN_ENABLED=false' \\
    'MOCK_ADMIN_TOKEN=' \\
    'MOCK_HOST=127.0.0.1' \\
    'MOCK_PORT=${mock_port}' \\
    'MOCK_RESPONSE_CONFIG=${mock_code_path}/config/responses.yaml' \\
    'LIANKE_EXPECTED_API_KEY=' \\
    'MOCK_CALLBACK_ALLOWLIST=${mock_callback_allowlist}' \\
    'MOCK_REQUEST_LOG_LIMIT=200' \\
    | install -m 600 /dev/stdin /etc/holun/mock-external-server.env

  printf '%s\\n' \\
    '[Unit]' \\
    'Description=Holun Mock External Server' \\
    'After=network-online.target' \\
    'Wants=network-online.target' \\
    '' \\
    '[Service]' \\
    'Type=simple' \\
    'User=holun-mock' \\
    'Group=holun-mock' \\
    'WorkingDirectory=${mock_code_path}' \\
    'EnvironmentFile=/etc/holun/mock-external-server.env' \\
    'ExecStart=${mock_code_path}/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${mock_port}' \\
    'Restart=on-failure' \\
    'RestartSec=5' \\
    'NoNewPrivileges=true' \\
    'PrivateTmp=true' \\
    'ProtectHome=true' \\
    'ProtectSystem=strict' \\
    'RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX' \\
    '' \\
    '[Install]' \\
    'WantedBy=multi-user.target' \\
    | install -m 644 /dev/stdin /etc/systemd/system/${mock_service_name}

  systemctl daemon-reload
  systemctl enable '${mock_service_name}'
"

"$(cd "$(dirname "$0")" && pwd)/start-mock-external-server.sh"
