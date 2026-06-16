# Environment Provisioning Playbook

> 新服务器 / 新环境首次启用前的基础软件、运行时和目录初始化手册。
> 本文件只列通用要求与检查清单，具体包管理命令请根据实际操作系统发行版调整。
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
- [ ] 初始化 Git 仓库并配置 SSH key，确保可拉取 `${YSHOP_GIT_REMOTE}` 远程仓库
- [ ] 安装 MySQL 8.0 Client（`mysql` 命令行工具），用于连接外部 MySQL 实例、导入 SQL 和排查数据
- [ ] 安装 Redis CLI，用于连接外部 Redis 实例和排查缓存
- [ ] 将 `application-dev.yaml` 或对应环境配置放置到正确位置
- [ ] 确认 `${YSHOP_PORT}` 端口可被访问

---

## 4. yshop-drink-vue 管理后台专用

- [ ] 安装 Node.js 18+ 和 pnpm 8+
- [ ] 创建远程静态资源目录 `${ADMIN_REMOTE_PATH}`
- [ ] 安装并配置 Nginx
- [ ] 配置 Nginx server 块，将请求指向 `${ADMIN_REMOTE_PATH}`
- [ ] 确认 Nginx 服务已启用并运行

---

## 5. icepolar-dms 设备管理系统专用

- [ ] 安装 Python 3.10+
- [ ] 创建代码目录 `${DMS_CODE_PATH}`
- [ ] 初始化 Git 仓库并配置拉取权限
- [ ] 创建 Python 虚拟环境 `venv/`
- [ ] 安装 `requirements.txt` 依赖
- [ ] 确认 `${DMS_PORT}` 端口可被访问

---

## 6. 可选 / 根据业务需要

- [ ] MQ 中间件（RocketMQ / RabbitMQ）—— 用于支付回调、订单超时、异步通知
- [ ] 日志收集（ELK、Loki、Promtail）
- [ ] 监控告警（Prometheus + Grafana、Node Exporter、Blackbox Exporter）
- [ ] MySQL 定时备份脚本
- [ ] SSL 证书（Let's Encrypt / 自签 / 商业证书）

---

## 7. 部署前置检查

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
```

检查全部通过后，再继续执行 `governance/PLAYBOOKS/deployment.md` 中的应用部署步骤。
