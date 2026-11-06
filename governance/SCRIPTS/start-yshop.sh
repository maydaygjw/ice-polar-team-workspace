#!/usr/bin/env bash
set -euo pipefail

# Start yshop backend for the loaded deployment environment.
# Usage:
#   source governance/SCRIPTS/deploy-helper.sh && load_env dev
#   source governance/SCRIPTS/deploy-helper.sh && load_env prod
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
    echo "Run: source governance/SCRIPTS/deploy-helper.sh && load_env dev or load_env prod" >&2
    exit 1
  fi
done

case "${ENV_NAME}" in
  dev|prod) ;;
  *)
    echo "Unsupported environment: ${ENV_NAME}. Supported environments: dev, prod." >&2
    exit 1
    ;;
esac

if [[ "${ENV_NAME}" = "prod" ]]; then
  for var_name in SPRING_PROFILES_ACTIVE; do
    if [[ -z "${!var_name:-}" ]]; then
      echo "Missing required production environment variable: ${var_name}" >&2
      exit 1
    fi
  done
fi

ssh "${DEPLOY_USER}@${SERVER_HOST}" "
  if systemctl list-unit-files | grep -q yshop.service; then
    systemctl unset-environment ADAPAY_DEBUG AI_IMAGE_ENABLED AI_FORMAT_ENABLED DASHSCOPE_API_KEY || true
    systemctl set-environment SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE:-}"
    systemctl start yshop.service
  else
    cd ${YSHOP_START_PATH}
    nohup java -jar target/${YSHOP_JAR} --spring.profiles.active="${SPRING_PROFILES_ACTIVE:-}" > ${YSHOP_START_PATH}/app.log 2>&1 &
  fi
"
