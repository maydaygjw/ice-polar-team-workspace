#!/usr/bin/env bash
set -euo pipefail

# Start yshop backend for the loaded deployment environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env test
#   bash governance/SCRIPTS/start-yshop.sh

required_vars=(
  ENV_NAME
  SERVER_HOST
  DEPLOY_USER
  YSHOP_START_PATH
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
  if systemctl list-unit-files | grep -q yshop.service; then
    if [ \"${ENV_NAME}\" = \"test\" ]; then
      set -a
      source ~/.bash_profile
      set +a
      if [ -z \"\${DASHSCOPE_API_KEY:-}\" ]; then
        echo 'DASHSCOPE_API_KEY is missing from ~/.bash_profile' >&2
        exit 1
      fi
      systemctl import-environment DASHSCOPE_API_KEY
      systemctl set-environment ADAPAY_DEBUG=true AI_IMAGE_ENABLED=true
    else
      systemctl unset-environment ADAPAY_DEBUG AI_IMAGE_ENABLED DASHSCOPE_API_KEY || true
    fi
    systemctl start yshop.service
  else
    cd ${YSHOP_START_PATH}
    if [ \"${ENV_NAME}\" = \"test\" ]; then
      set -a
      source ~/.bash_profile
      set +a
      if [ -z \"\${DASHSCOPE_API_KEY:-}\" ]; then
        echo 'DASHSCOPE_API_KEY is missing from ~/.bash_profile' >&2
        exit 1
      fi
      ADAPAY_DEBUG=true AI_IMAGE_ENABLED=true nohup java -jar target/${YSHOP_JAR} > ${YSHOP_START_PATH}/app.log 2>&1 &
    else
      nohup java -jar target/${YSHOP_JAR} > ${YSHOP_START_PATH}/app.log 2>&1 &
    fi
  fi
"
