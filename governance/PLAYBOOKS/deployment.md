# Deployment Playbook

> 所有环境部署步骤和回滚流程的统一手册。
> **本文件不包含任何真实服务器信息。** 执行前必须加载目标环境配置。
> Agent 执行部署前必须读取此文件。

## 使用前准备

1. 根据目标环境加载对应配置文件：

   ```bash
   source governance/SCRIPTS/deploy-helper.sh && load_env test
   ```

2. 确认已配置 SSH key 登录，禁止在脚本中硬编码密码。
3. 如果是新服务器 / 首次搭建环境，请先按 `governance/PLAYBOOKS/environment-provisioning.md` 完成基础软件、运行时和目录初始化。
4. 确认已阅读本 playbook 中对应服务的部署步骤和健康检查。

---

## 环境概览

| 环境 | 用途 | 配置文件 |
|------|------|----------|
| 测试环境 | 功能验证、集成测试 | `governance/ENVIRONMENTS/test.env` |
| 生产环境 | 线上服务 | `governance/ENVIRONMENTS/prod.env` |

---

## 测试环境数据库

测试环境使用 `application-dev.yaml`（`backend/yshop-server/src/main/resources/application-dev.yaml`）中配置的 MySQL 实例。

| 属性 | 值 |
|------|-----|
| 数据库引擎 | MySQL 8.0 |
| 宿主机 | `${DB_HOST}` |
| 端口 | `${DB_PORT}` |
| 数据库名 | `${DB_NAME}` |
| 用户名 | `${DB_USER}` |
| 密码 | 见 `application-dev.yaml` 中 `spring.datasource.dynamic.datasource.master.password` |
| JDBC URL | 见 `application-dev.yaml` 中 `spring.datasource.dynamic.datasource.master.url` |

> 连接方式：通过 SSH 登录宿主机后，使用 `mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER} -p ${DB_NAME}` 连接，或从本地通过 `ssh -L` 隧道连接。

## 数据库迁移

1. **执行顺序**：按功能迭代顺序依次执行 `sql/upgrade-*.sql`；若历史脚本未执行，必须先补齐，再执行本次脚本。
2. **字段级 patch**：新增字段、修改字段长度/注释等 `ALTER TABLE` 操作，**无需重启后端服务**。MyBatis Plus 会在运行时动态映射字段。
3. **必须重启的场景**：
   - 新增/修改了 Java 代码逻辑、配置、枚举、错误码。
   - 修改了表结构导致旧代码无法运行（例如代码引用了一个不存在的字段）。
   - 新增表后首次被代码访问（只要表已存在且字段兼容，则无需重启）。

---

## yshop（后端）

**基本信息**

| 属性 | 值 |
|------|-----|
| 应用名称 | yshop |
| 技术栈 | Java 17 + Maven + Spring Boot |
| 关联服务器 | `${SERVER_HOST}` |
| 部署用户 | `${DEPLOY_USER}` |
| 代码路径 | `${YSHOP_CODE_PATH}` |
| 启动路径 | `${YSHOP_START_PATH}` |
| JAR 文件 | `${YSHOP_JAR}` |

**部署步骤**

```bash
# 1. 拉取最新代码
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${YSHOP_CODE_PATH} && git pull origin master"

# 2. 备份当前 JAR
ssh ${DEPLOY_USER}@${SERVER_HOST} "
  if [ -f ${YSHOP_START_PATH}/target/${YSHOP_JAR} ]; then
    cp ${YSHOP_START_PATH}/target/${YSHOP_JAR} ${YSHOP_START_PATH}/target/${YSHOP_JAR}.bak.\$(date +%Y%m%d%H%M%S)
  fi
"

# 3. 停止旧进程；如服务器使用 systemd 管理，优先用 systemctl
#    注意：不要同时用 systemctl stop + pkill，否则 systemd 的 Restart=on-failure
#    会立刻拉起新进程，导致后续启动时的端口冲突。
bash governance/SCRIPTS/stop-yshop.sh

# 4. 打包
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${YSHOP_CODE_PATH} && mvn clean package -DskipTests"

# 5. 启动服务；测试环境会在脚本内注入 ADAPAY_DEBUG=true
bash governance/SCRIPTS/start-yshop.sh

# 6. 验证服务是否启动（用 [j]ava 前缀排除 grep/SSH shell 自身的误匹配）
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep '[j]ava -jar target/${YSHOP_JAR}'"

# 7. 等待 Spring Boot 启动完成并验证端口（最多等 120s）
ssh ${DEPLOY_USER}@${SERVER_HOST} "
  for i in \$(seq 1 120); do
    if ss -tlnp | grep -q ${YSHOP_PORT}; then
      echo 'Port ${YSHOP_PORT} is listening'
      break
    fi
    sleep 1
  done
"
# 检查启动结果
ssh ${DEPLOY_USER}@${SERVER_HOST} "ss -tlnp | grep ${YSHOP_PORT}"
```

> **注意**：
> - 若启动失败并提示端口被占用，说明旧进程未停干净，执行 `fuser -k ${YSHOP_PORT}/tcp` 后重试。
> - 测试环境启动 yshop 时必须通过 `governance/SCRIPTS/start-yshop.sh` 注入 `ADAPAY_DEBUG=true`；生产环境不得开启。
> - 生产环境由 `systemd` 管理，必须通过 `systemctl start/stop yshop.service` 启停。
> - **禁止**同时使用 `systemctl stop` 和 `pkill`。`Restart=on-failure` 的 systemd 服务在收到进程退出信号后会立刻重新拉起，此时再 `pkill` 反而会触发重启，导致短暂端口 8080 被占用，Spring Boot 启动失败。
> - 停止旧进程后，应**轮询等待进程完全退出**（推荐方式见 `governance/SCRIPTS/stop-yshop.sh`），而非固定 `sleep 3`。

**健康检查**

```bash
# 检查进程存活（用 [j]ava 前缀排除 grep/SSH shell 自身的误匹配）
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep '[j]ava -jar target/${YSHOP_JAR}'"

# 检查 systemd 服务状态（生产环境）
ssh ${DEPLOY_USER}@${SERVER_HOST} "systemctl status yshop.service --no-pager | head -15"

# 检查日志（最近 50 行）— 优先查 systemd journal（生产环境日志可能不走文件回写）
ssh ${DEPLOY_USER}@${SERVER_HOST} "journalctl -u yshop.service --no-pager -n 30"

# 检查端口监听
ssh ${DEPLOY_USER}@${SERVER_HOST} "ss -tlnp | grep ${YSHOP_PORT}"
```

---

## yshop-drink-vue（管理后台）

**基本信息**

| 属性 | 值 |
|------|-----|
| 应用名称 | yshop-drink-vue |
| 技术栈 | Vue3 + Vite + pnpm |
| 关联服务器 | `${SERVER_HOST}` |
| 部署用户 | `${DEPLOY_USER}` |
| 代码路径 | `${YSHOP_CODE_PATH}` |
| 构建输出目录 | `dist/` |
| Nginx 静态资源目录 | `${ADMIN_REMOTE_PATH}` |

**部署步骤**

```bash
# 1. 本地构建（在 ${ADMIN_LOCAL_PATH}/ 目录下执行）
cd ${ADMIN_LOCAL_PATH} && ${ADMIN_BUILD_CMD}

# 2. 将构建产物打包为压缩包，减少小文件 SSH 传输 overhead
cd ${ADMIN_LOCAL_PATH}/dist
tar czf ../dist.tar.gz .

# 3. 上传压缩包到服务器临时目录
scp ${ADMIN_LOCAL_PATH}/dist.tar.gz ${DEPLOY_USER}@${SERVER_HOST}:${ADMIN_REMOTE_PATH}/../dist.tar.gz

# 4. 在服务器上解压并整体替换 Nginx 静态资源目录
ssh ${DEPLOY_USER}@${SERVER_HOST} "
  cd ${ADMIN_REMOTE_PATH}/.. && \
  rm -rf ${ADMIN_REMOTE_PATH} && \
  mkdir -p ${ADMIN_REMOTE_PATH} && \
  tar xzf dist.tar.gz -C ${ADMIN_REMOTE_PATH} && \
  rm -f dist.tar.gz
"

# 5. 验证文件已上传
ssh ${DEPLOY_USER}@${SERVER_HOST} "ls -la ${ADMIN_REMOTE_PATH}/ | head -20"
```

> **说明**：
> - 测试环境使用 `${ADMIN_BUILD_CMD}` 构建。如需构建生产环境版本，将对应环境的 `ADMIN_BUILD_CMD` 改为 `pnpm build:prod`。
> - 使用 `tar.gz` 整体替换，避免 `scp -r` 逐个文件传输 1000+ 小文件的 SSH 握手开销；同时保证每次部署目录与本地 `dist/` 完全一致。

**健康检查**

```bash
# 检查静态资源目录
ssh ${DEPLOY_USER}@${SERVER_HOST} "ls -la ${ADMIN_REMOTE_PATH}/ | head -20"

# 检查 Nginx 服务状态（如已配置）
ssh ${DEPLOY_USER}@${SERVER_HOST} "systemctl status nginx"
```

---

## icepolarminiapp（小程序）

> TODO: 待补充

---

## icepolar-dms（设备管理系统）

**基本信息**

| 属性 | 值 |
|------|-----|
| 应用名称 | icepolar-dms |
| 技术栈 | Python + FastAPI |
| 关联服务器 | `${SERVER_HOST}` |
| 部署用户 | `${DEPLOY_USER}` |
| 代码路径 | `${DMS_CODE_PATH}` |
| 主服务启动脚本 | `${DMS_CODE_PATH}/scripts/start_main.sh` |
| 模拟器启动脚本 | `${DMS_CODE_PATH}/scripts/start_simulator.sh` |
| 启动端口 | `${DMS_PORT}` |

**部署步骤**

```bash
# 1. 拉取最新代码
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${DMS_CODE_PATH} && git pull"

# 2. 进入虚拟环境并安装/更新依赖
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${DMS_CODE_PATH} && source venv/bin/activate && pip install -r requirements.txt"

# 3. 停止旧进程
ssh ${DEPLOY_USER}@${SERVER_HOST} "kill \$(ps -ef | grep 'start_main.sh' | grep -v grep | awk '{print \$2}')" 2>/dev/null || true
ssh ${DEPLOY_USER}@${SERVER_HOST} "kill \$(ps -ef | grep 'uvicorn app.main:app' | grep -v grep | awk '{print \$2}')" 2>/dev/null || true

# 4. 进入虚拟环境并通过启动脚本启动主服务
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${DMS_CODE_PATH} && source venv/bin/activate && nohup ./scripts/start_main.sh -p ${DMS_PORT} --no-reload > /dev/null 2>&1 &"

# 5. 验证服务是否启动
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep 'start_main.sh' | grep -v grep"
```

**健康检查**

```bash
# 检查进程存活
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep 'start_main.sh' | grep -v grep"

# 检查日志（最近 50 行）
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -n 50 ${DMS_CODE_PATH}/scripts/main.log"

# 检查端口监听
ssh ${DEPLOY_USER}@${SERVER_HOST} "ss -tlnp | grep ${DMS_PORT}"
```

**模拟器**

```bash
# 启动模拟器（按需）
ssh ${DEPLOY_USER}@${SERVER_HOST} "cd ${DMS_CODE_PATH} && source venv/bin/activate && nohup ./scripts/start_simulator.sh > /dev/null 2>&1 &"

# 检查模拟器进程
ssh ${DEPLOY_USER}@${SERVER_HOST} "ps -ef | grep 'start_simulator.sh' | grep -v grep"

# 检查模拟器日志
ssh ${DEPLOY_USER}@${SERVER_HOST} "tail -n 50 ${DMS_CODE_PATH}/scripts/simulator.log"
```

---

## 通用规则

1. **测试优先** — 任何变更必须先部署到测试环境验证通过
2. **禁止高峰期部署** — 生产环境部署需避开业务高峰时段
3. **保留回滚能力** — 部署前备份当前运行的 JAR/构建产物
4. **部署后验证** — 检查进程、日志、端口、关键 API 响应
5. **凭证管理** — 禁止在脚本中硬编码密码或密钥，使用 SSH key 或环境变量注入
