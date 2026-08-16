# Environment Provisioning Playbook

> 新服务器 / 新环境首次启用前的基础软件、运行时和目录初始化手册。
> 本文件只列通用要求与检查清单，具体包管理命令请根据实际操作系统发行版调整。
> MySQL 与 Redis 均使用外部托管服务（如阿里云 RDS / Redis），应用服务器上只需安装客户端，不需要本地启动 Server。
> 完成本 playbook 后，再按 `governance/PLAYBOOKS/deployment.md` 执行应用部署。

---

## 1. 操作系统基础

- [ ] Linux 服务器（推荐 Ubuntu 22.04 LTS / CentOS 7+）
- [ ] 创建部署用户并配置 SSH key 登录，禁止密码登录
- [ ] 配置时区（如 `Asia/Shanghai`）和 NTP 同步
- [ ] 配置防火墙，仅开放必要端口（SSH、HTTP、HTTPS、业务端口）
- [ ] 配置合理的 swap 或关闭 swap（根据业务要求）
- [ ] 配置主机名和 `/etc/hosts`

---

## 2. 通用运行时与工具

| 组件 | 用途 | 当前版本要求 |
|------|------|-------------|
| OpenJDK 17 | yshop 后端运行与打包 | 17 |
| Maven 3.8+ | yshop 后端构建 | 3.8.x |
| Node.js 18+ | yshop-drink-vue 构建 | 18.x |
| pnpm 8+ | yshop-drink-vue 包管理 | 8.x |
| Python 3.10+ | icepolar-dms 运行 | 3.10+ |
| venv + pip | icepolar-dms 依赖隔离 | 随 Python 自带 |
| Nginx | 管理后台静态资源 / 反向代理 | 1.20+ |
| MySQL 8.0 Client | 命令行连接、导入 SQL、排查数据 | 8.0 |
| Redis CLI | 缓存排查、命令行操作 Redis | 6.x / 7.x |
| Git | 代码拉取 | 2.x |

---

## 3. yshop 后端专用

- [ ] 安装 OpenJDK 17
- [ ] 安装 Maven 3.8+
- [ ] 创建代码目录 `${YSHOP_CODE_PATH}`
- [ ] 配置 SSH key 登录 Gitee，确保可拉取仓库
  - 仓库地址统一从 workspace 根目录 `.gitmodules` 读取
  - 后端示例：`git@gitee.com:icepolar/yshop-drink.git`（SSH 协议）
- [ ] 安装 MySQL 8.0 Client（`mysql` 命令行工具），用于连接外部 MySQL/RDS 实例、导入 SQL 和排查数据
- [ ] 安装 Redis CLI，用于连接外部 Redis 实例和排查缓存
- [ ] 确认应用服务器可访问外部 MySQL 与 Redis 的网络和端口（如安全组、白名单）
- [ ] 将 `application-*.yaml` 或对应环境配置放置到正确位置，确保数据库与 Redis 连接信息指向外部实例
- [ ] 生产 `yshop.service` 配置 `Environment=SPRING_PROFILES_ACTIVE=prod`，确保服务器重启后不会回退到 `local`

---

## 4. yshop-drink-vue 管理后台专用

- [ ] 安装 Node.js 18+ 和 pnpm 8+
- [ ] 创建远程静态资源目录 `${ADMIN_REMOTE_PATH}`
- [ ] 安装并启动 Nginx
- [ ] 配置 Nginx server 块，将请求指向 `${ADMIN_REMOTE_PATH}`
- [ ] （可选）配置 Nginx 反向代理到 `${YSHOP_PORT}` 端口，统一管理后台 API 调用
- [ ] 确认 Nginx 服务已启用并运行

**Nginx 配置示例**

管理后台静态资源 + 反向代理后端 API 的参考配置：

```nginx
server {
    listen 80;
    server_name _; # 或填写实际域名

    # 管理后台静态资源
    location / {
        root ${ADMIN_REMOTE_PATH};
        index index.html index.htm;
        try_files \$uri \$uri/ /index.html;
    }

    # 反向代理到 yshop 后端 API（可选）
    location /admin-api/ {
        proxy_pass http://127.0.0.1:${YSHOP_PORT}/admin-api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /app-api/ {
        proxy_pass http://127.0.0.1:${YSHOP_PORT}/app-api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
```

放置到 Nginx 配置目录后重载：

```bash
# Rocky / CentOS
sudo systemctl enable nginx
sudo systemctl start nginx
sudo nginx -t && sudo systemctl reload nginx
```

---

## 5. icepolar-dms 设备管理系统专用

- [ ] 安装 Python 3.10+
- [ ] 创建代码目录 `${DMS_CODE_PATH}`
- [ ] 配置 SSH key 登录 Gitee，确保可拉取仓库
  - 仓库地址统一从 workspace 根目录 `.gitmodules` 读取
  - DMS 示例：`git@gitee.com:icepolar/dms.git`（SSH 协议）
- [ ] 创建 Python 虚拟环境 `venv/`
- [ ] 安装 `requirements.txt` 依赖
- [ ] 确认 `${DMS_PORT}` 端口可被访问
- [ ] 配置 MySQL 数据库连接：
  - 在 `${DMS_CODE_PATH}/.env` 中配置 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD`
  - 数据库连接信息以 `${DMS_CODE_PATH}/.env` 为准
  - 执行 `python scripts/init_db.py` 初始化表结构

---

## 6. mock-external-server

用于在 rprod18 上运行链科云打印协议 Mock，供 API、集成测试和端到端测试使用。首次初始化只执行一次；完成后，版本更新统一按 `governance/PLAYBOOKS/deployment.md` 通过 Git 提交和拉取完成。

**当前目标信息**

| 属性 | 值 |
|------|-----|
| 服务器 | `rprod18` |
| 代码目录 | `/opt/holun/mock-external-server` |
| 运行用户 | `holun-mock` |
| systemd 服务 | `mock-external-server.service` |
| 监听地址 | `127.0.0.1:8085` |
| 响应配置 | `/opt/holun/mock-external-server/config/responses.yaml` |

**首次初始化步骤**

执行前必须确认 `mock-external-server` 的代码已经提交并推送到 Gitee `master` 分支：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env dev
bash governance/SCRIPTS/provision-mock-external-server.sh
```

脚本会创建系统用户、代码目录、虚拟环境、生产环境文件和 systemd 单元，并启动服务。

服务只监听本机回环地址，生产管理接口关闭。后端接入时使用 `LIANKE_PRINT_HOST=http://127.0.0.1:8085/api`；异常场景应在受控测试实例中开启管理面，不要直接开放生产管理接口。

---

## 7. 可选 / 根据业务需要

- [ ] MQ 中间件（RocketMQ / RabbitMQ）—— 当前生产暂未使用；启用相关异步链路前再部署并恢复对应自动配置
- [ ] 日志收集（ELK、Loki、Promtail）
- [ ] 监控告警（Prometheus + Grafana、Node Exporter、Blackbox Exporter）
- [ ] MySQL 定时备份脚本
- [ ] SSL 证书（Let's Encrypt / 自签 / 商业证书）

---

## 8. 部署前置检查

完成以上步骤后，请执行以下检查，确认环境已就绪：

```bash
# 加载目标环境配置
source governance/SCRIPTS/deploy-helper.sh && load_env test

# 检查 Java 版本
ssh ${DEPLOY_USER}@${SERVER_HOST} "java -version"

# 检查 Maven 版本
ssh ${DEPLOY_USER}@${SERVER_HOST} "mvn -version"

# 检查 Node 和 pnpm 版本
ssh ${DEPLOY_USER}@${SERVER_HOST} "node -v && pnpm -v"

# 检查 Python 版本
ssh ${DEPLOY_USER}@${SERVER_HOST} "python3 --version && pip3 --version"

# 检查 MySQL Client 是否可用
ssh ${DEPLOY_USER}@${SERVER_HOST} "mysql --version"

# 检查 Redis CLI 是否可用
ssh ${DEPLOY_USER}@${SERVER_HOST} "redis-cli --version || redis-cli -v"

# 检查 Nginx 服务
ssh ${DEPLOY_USER}@${SERVER_HOST} "systemctl status nginx"

# 检查外网连通性（示例：阿里云 RDS MySQL 端口）
ssh ${DEPLOY_USER}@${SERVER_HOST} "nc -zv ${DB_HOST} ${DB_PORT}"

# 检查外网连通性（示例：阿里云 Redis 端口）
ssh ${DEPLOY_USER}@${SERVER_HOST} "nc -zv ${REDIS_HOST} ${REDIS_PORT}"
```

检查全部通过后，再继续执行 `governance/PLAYBOOKS/deployment.md` 中的应用部署步骤。
