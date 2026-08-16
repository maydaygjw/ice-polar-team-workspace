# Deployment Playbook

> 统一部署和回滚流程。执行前必须加载目标环境配置；禁止在文档、脚本或命令中写入真实凭据。

## 通用要求

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test   # 或 prod
```

- 先测试、后生产；生产操作必须获得明确授权并避开业务高峰。
- 测试和生产统一使用 JDK 21；首次部署先执行 `environment-provisioning.md`。
- 部署前备份当前制品，部署后检查进程、日志、端口、commit 和关键接口。
- 生产禁止执行 Maven 构建、下载依赖或手工修改 JAR。
- 数据库迁移必须单独确认；只部署应用时不自动执行 SQL。

## yshop 后端

### 发布规则

- 生产只使用测试环境当前运行且验证通过的 JAR。
- 测试 JAR 必须同时满足：测试服务健康、JDK 21、完整 Git commit 可读、`application-prod.yaml` 已包含正确生产配置。
- `application-prod.yaml` 不得保留本机数据库、Redis、DMS、MQ 默认地址或可替换环境变量占位配置。
- 测试 JAR 下载和生产上传必须通过 SHA-256 校验；任何校验失败立即停止。
- 生产必须以 `SPRING_PROFILES_ACTIVE=prod` 启动。当前生产不使用 RocketMQ、RabbitMQ、Kafka。

### 发布步骤

以下命令在同一 shell 中执行。测试环境实际由裸进程管理时，用进程和端口检查，不要求 systemd。

```bash
set -e
source governance/SCRIPTS/deploy-helper.sh && load_env test
TEST_HOST="$SERVER_HOST"; TEST_USER="$DEPLOY_USER"
TEST_PATH="$YSHOP_START_PATH"; TEST_JAR="$YSHOP_JAR"; TEST_PORT="$YSHOP_PORT"

# 1. 验证测试服务和 JAR
ssh "$TEST_USER@$TEST_HOST" "
  java -version 2>&1 | grep -q 'version \"21' \\
  && ss -tlnp | grep -q ':${TEST_PORT}' \\
  && ps -ef | grep '[j]ava -jar target/${TEST_JAR}' \\
  && test -s '${TEST_PATH}/target/${TEST_JAR}'
"
ARTIFACT_COMMIT="$(ssh "$TEST_USER@$TEST_HOST" \
  "unzip -p '${TEST_PATH}/target/${TEST_JAR}' BOOT-INF/classes/git.properties 2>/dev/null | sed -n 's/^git.commit.id.full=//p' | head -1")"
test -n "$ARTIFACT_COMMIT"

# 2. 确认 JAR 内的生产配置不是默认配置（命中即停止）
ssh "$TEST_USER@$TEST_HOST" "
  if unzip -p '${TEST_PATH}/target/${TEST_JAR}' BOOT-INF/classes/application-prod.yaml | \
     grep -Eq '127\\.0\\.0\\.1:3306|YSHOP_DB_URL:|REDIS_HOST:127\\.0\\.0\\.1|DMS_HOST:.*127\\.0\\.0\\.1|ROCKETMQ_NAME_SERVER:127\\.0\\.0\\.1|RABBITMQ_HOST:127\\.0\\.0\\.1|KAFKA_BOOTSTRAP_SERVERS:127\\.0\\.0\\.1'; then
    echo 'application-prod.yaml contains default production endpoints' >&2
    exit 1
  fi
"

# 3. 下载测试 JAR并计算校验值
ARTIFACT_DIR="$(mktemp -d /tmp/yshop-release.XXXXXX)"
ARTIFACT_FILE="$ARTIFACT_DIR/$TEST_JAR"
scp "$TEST_USER@$TEST_HOST:$TEST_PATH/target/$TEST_JAR" "$ARTIFACT_FILE"
ARTIFACT_SHA256="$(shasum -a 256 "$ARTIFACT_FILE" | awk '{print $1}')"

# 4. 加载生产环境，确认生产服务使用 JDK 21
source governance/SCRIPTS/deploy-helper.sh && load_env prod
ssh "$DEPLOY_USER@$SERVER_HOST" "
  test -x /usr/lib/jvm/java-21-openjdk/bin/java
  systemctl cat yshop.service | grep -q '/usr/lib/jvm/java-21-openjdk/bin/java'
"

# 5. 上传临时文件并校验 SHA-256
REMOTE_INCOMING="$YSHOP_START_PATH/target/.$YSHOP_JAR.$ARTIFACT_COMMIT.incoming"
scp "$ARTIFACT_FILE" "$DEPLOY_USER@$SERVER_HOST:$REMOTE_INCOMING"
REMOTE_SHA256="$(ssh "$DEPLOY_USER@$SERVER_HOST" "sha256sum '$REMOTE_INCOMING' | awk '{print \$1}'")"
test "$ARTIFACT_SHA256" = "$REMOTE_SHA256"

# 6. 备份、停止、替换并启动
ssh "$DEPLOY_USER@$SERVER_HOST" "
  cp '$YSHOP_START_PATH/target/$YSHOP_JAR' '$YSHOP_START_PATH/target/$YSHOP_JAR.bak.\$(date +%Y%m%d%H%M%S)'
"
bash governance/SCRIPTS/stop-yshop.sh
ssh "$DEPLOY_USER@$SERVER_HOST" "
  mv '$REMOTE_INCOMING' '$YSHOP_START_PATH/target/$YSHOP_JAR'
  unzip -p '$YSHOP_START_PATH/target/$YSHOP_JAR' BOOT-INF/classes/git.properties | grep -q '^git.commit.id.full=$ARTIFACT_COMMIT$'
"
bash governance/SCRIPTS/start-yshop.sh

# 7. 健康检查：最多等待 120 秒
for i in $(seq 1 120); do
  if ssh "$DEPLOY_USER@$SERVER_HOST" "ss -tlnp | grep -q ':$YSHOP_PORT'"; then break; fi
  sleep 1
done
ssh "$DEPLOY_USER@$SERVER_HOST" "
  systemctl is-active yshop.service
  curl -fsS --max-time 5 http://127.0.0.1:$YSHOP_PORT/ >/dev/null
  journalctl -u yshop.service --no-pager -n 30
"
```

### 回滚

新 JAR 启动失败、端口未监听或健康检查失败时，立即停止服务，恢复部署前最新的 `.bak.<timestamp>` JAR，再执行 `start-yshop.sh` 并重新检查日志和接口。禁止改为在生产重新构建。

## 管理后台

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env prod
cd "$ADMIN_LOCAL_PATH" && $ADMIN_BUILD_CMD
cd dist && COPYFILE_DISABLE=1 tar czf ../dist.tar.gz .
scp "$ADMIN_LOCAL_PATH/dist.tar.gz" "$DEPLOY_USER@$SERVER_HOST:$ADMIN_REMOTE_PATH/../dist.tar.gz"
ssh "$DEPLOY_USER@$SERVER_HOST" "
  cd '$ADMIN_REMOTE_PATH/..'
  mv '$ADMIN_REMOTE_PATH' '${ADMIN_REMOTE_PATH}.bak' 2>/dev/null || true
  mkdir -p '$ADMIN_REMOTE_PATH'
  tar xzf dist.tar.gz -C '$ADMIN_REMOTE_PATH'
  nginx -t && systemctl reload nginx
"
```

部署后检查 `${ADMIN_REMOTE_PATH}` 文件和 Nginx 状态；失败时恢复 `.bak` 目录。

## icepolar-dms

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env prod
ssh "$DEPLOY_USER@$SERVER_HOST" "cd '$DMS_CODE_PATH' && git pull && source venv/bin/activate && pip install -r requirements.txt"
ssh "$DEPLOY_USER@$SERVER_HOST" "cd '$DMS_CODE_PATH' && ./scripts/stop_main.sh || true && nohup ./scripts/start_main.sh -p '$DMS_PORT' --no-reload >/dev/null 2>&1 &"
ssh "$DEPLOY_USER@$SERVER_HOST" "ss -tlnp | grep ':$DMS_PORT'"
```

## mock-external-server

代码提交并推送后，按 [`environment-provisioning.md`](environment-provisioning.md) 初始化，使用专用脚本部署和回滚：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env dev
bash governance/SCRIPTS/deploy-mock-external-server.sh
KNOWN_GOOD_COMMIT="replace-with-known-good-commit"
bash governance/SCRIPTS/rollback-mock-external-server.sh "$KNOWN_GOOD_COMMIT"
```

## 其他

- `icepolarminiapp`：TODO，待补充发布流程。
- 生产 MQ 当前未使用；启用前必须补充中间件部署、配置和回滚方案。
