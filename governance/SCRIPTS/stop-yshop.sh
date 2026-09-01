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

ssh "${DEPLOY_USER}@${SERVER_HOST}" bash -s -- "${YSHOP_JAR}" <<'REMOTE_SCRIPT'
set -euo pipefail

jar_name="$1"
find_pid() {
  ps -eo pid=,args= | awk -v target="target/$jar_name" \
    '$3 == "-jar" && $4 == target { print $1; exit }'
}

if systemctl list-units --type=service | grep -q yshop.service; then
  systemctl stop yshop.service || true
fi

# 裸进程模式：只匹配 Java 的实际 argv，避免 pgrep/pkill -f 把 SSH 命令自身匹配进去。
pid="$(find_pid || true)"
if [[ -n "$pid" ]]; then
  kill -TERM "$pid"
fi
for i in $(seq 1 30); do
  if [[ -z "$(find_pid || true)" ]]; then
    exit 0
  fi
  sleep 1
done

pid="$(find_pid || true)"
if [[ -n "$pid" ]]; then
  kill -KILL "$pid"
fi
REMOTE_SCRIPT
