#!/usr/bin/env bash
set -euo pipefail

# Stop yshop backend for the loaded deployment environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env test
#   bash governance/SCRIPTS/stop-yshop.sh

required_vars=(
  SERVER_HOST
  DEPLOY_USER
  YSHOP_JAR
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required environment variable: ${var_name}" >&2
    echo "Run: source governance/SCRIPTS/deploy-helper.sh && load_env <env-name>" >&2
    exit 1
  fi
done

ssh "${DEPLOY_USER}@${SERVER_HOST}" "
  if systemctl list-units --type=service | grep -q yshop.service; then
    systemctl stop yshop.service || true
    for i in \$(seq 1 30); do
      if ! pgrep -f '[j]ava -jar target/${YSHOP_JAR}' > /dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  else
    pkill -9 -f '[j]ava -jar target/${YSHOP_JAR}' || true
    sleep 3
  fi
"
