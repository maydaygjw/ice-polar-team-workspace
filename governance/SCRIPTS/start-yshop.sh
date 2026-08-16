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

if [[ "${ENV_NAME}" = "prod" ]]; then
  for var_name in SPRING_PROFILES_ACTIVE YSHOP_SECRET_ENV_FILE; do
    if [[ -z "${!var_name:-}" ]]; then
      echo "Missing required production environment variable: ${var_name}" >&2
      exit 1
    fi
  done
fi

ssh "${DEPLOY_USER}@${SERVER_HOST}" "
  # test 环境统一从 ~/.bash_profile 加载并校验密钥一次，供下方两条启动路径共用
  if [ \"${ENV_NAME}\" = \"test\" ]; then
    set -a
    source ~/.bash_profile
    set +a
    if [ -z \"\${DASHSCOPE_API_KEY:-}\" ]; then
      echo 'DASHSCOPE_API_KEY is missing from ~/.bash_profile' >&2
      exit 1
    fi
  fi

  if [ "${ENV_NAME}" = "prod" ]; then
    if [ ! -r "${YSHOP_SECRET_ENV_FILE}" ]; then
      echo 'Production secret environment file is missing or unreadable: ${YSHOP_SECRET_ENV_FILE}' >&2
      exit 1
    fi
    set -a
    . "${YSHOP_SECRET_ENV_FILE}"
    set +a
    # The deployment environment selects the profile; a secret file must not
    # be able to accidentally switch a production start to local/dev.
    export SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE}"
    for var_name in DB_HOST DB_PORT DB_NAME DB_USER REDIS_HOST REDIS_PORT REDIS_DATABASE DMS_HOST YSHOP_ADMIN_UI_URL YSHOP_H5_URL YSHOP_ENCRYPT_PASSWORD KDNIAO_API_KEY KDNIAO_BUSINESS_ID; do
      if [ -z "\${!var_name:-}" ]; then
        echo "Missing required production setting: \${var_name}" >&2
        exit 1
      fi
    done
  fi

  if systemctl list-unit-files | grep -q yshop.service; then
    if [ \"${ENV_NAME}\" = \"test\" ]; then
      systemctl import-environment DASHSCOPE_API_KEY
      systemctl set-environment ADAPAY_DEBUG=true AI_IMAGE_ENABLED=true
    else
      systemctl unset-environment ADAPAY_DEBUG AI_IMAGE_ENABLED DASHSCOPE_API_KEY || true
      systemctl set-environment SPRING_PROFILES_ACTIVE="${SPRING_PROFILES_ACTIVE}"
      systemctl import-environment DB_HOST DB_PORT DB_NAME DB_USER REDIS_HOST REDIS_PORT REDIS_DATABASE DMS_HOST YSHOP_ADMIN_UI_URL YSHOP_H5_URL YSHOP_ENCRYPT_PASSWORD KDNIAO_API_KEY KDNIAO_BUSINESS_ID
    fi
    systemctl start yshop.service
  else
    cd ${YSHOP_START_PATH}
    if [ \"${ENV_NAME}\" = \"test\" ]; then
      ADAPAY_DEBUG=true AI_IMAGE_ENABLED=true nohup java -jar target/${YSHOP_JAR} --spring.profiles.active=dev > ${YSHOP_START_PATH}/app.log 2>&1 &
    else
      nohup java -jar target/${YSHOP_JAR} --spring.profiles.active="${SPRING_PROFILES_ACTIVE}" > ${YSHOP_START_PATH}/app.log 2>&1 &
    fi
  fi
"
