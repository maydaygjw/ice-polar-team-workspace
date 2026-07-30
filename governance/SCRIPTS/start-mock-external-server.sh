#!/usr/bin/env bash
set -euo pipefail

# Start mock-external-server through systemd.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   bash governance/SCRIPTS/start-mock-external-server.sh
#
# MOCK_SERVER_HOST, MOCK_DEPLOY_USER, MOCK_SERVICE_NAME, MOCK_PORT and
# MOCK_HEALTH_URL can be overridden for another environment.

mock_server_host="${MOCK_SERVER_HOST:-rprod18}"
mock_deploy_user="${MOCK_DEPLOY_USER:-root}"
mock_service_name="${MOCK_SERVICE_NAME:-mock-external-server.service}"
mock_port="${MOCK_PORT:-8085}"
mock_health_url="${MOCK_HEALTH_URL:-http://127.0.0.1:${mock_port}/health}"

ssh "${mock_deploy_user}@${mock_server_host}" "
  systemctl start '${mock_service_name}'
  systemctl is-active --quiet '${mock_service_name}'
  ss -tlnp | grep -q ':${mock_port}\\b'
  curl -fsS --max-time 5 '${mock_health_url}'
  printf '\\n'
"

echo "Started ${mock_service_name} on ${mock_server_host}:${mock_port}"
