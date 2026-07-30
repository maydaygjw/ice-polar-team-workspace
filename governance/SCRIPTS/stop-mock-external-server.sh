#!/usr/bin/env bash
set -euo pipefail

# Stop mock-external-server through systemd and wait for it to exit.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   bash governance/SCRIPTS/stop-mock-external-server.sh
#
# MOCK_SERVER_HOST, MOCK_DEPLOY_USER and MOCK_SERVICE_NAME can be overridden
# for another environment.

mock_server_host="${MOCK_SERVER_HOST:-rprod18}"
mock_deploy_user="${MOCK_DEPLOY_USER:-root}"
mock_service_name="${MOCK_SERVICE_NAME:-mock-external-server.service}"

ssh "${mock_deploy_user}@${mock_server_host}" "
  systemctl stop '${mock_service_name}'
  for i in \$(seq 1 30); do
    if ! systemctl is-active --quiet '${mock_service_name}'; then
      exit 0
    fi
    sleep 1
  done
  echo 'Timed out waiting for ${mock_service_name} to stop' >&2
  systemctl --no-pager --full status '${mock_service_name}' || true
  exit 1
"

echo "Stopped ${mock_service_name} on ${mock_server_host}"
