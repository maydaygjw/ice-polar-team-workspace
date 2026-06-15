# Deployment Playbook

> 所有环境服务器信息、部署步骤和回滚流程的统一手册。
> Agent 执行部署前必须读取此文件。

## 环境概览

| 环境 | 用途 |
|------|------|
| 测试环境 | 功能验证、集成测试 |
| 生产环境 | 线上服务（待补充） |

---

## 测试环境数据库

测试环境使用 `application-dev.yaml`（`backend/yshop-server/src/main/resources/application-dev.yaml`）中配置的 MySQL 实例。

| 属性 | 值 |
|------|------|
| 数据库引擎 | MySQL 8.0 |
| 宿主机 | `47.101.64.142` |
| 端口 | `13306` |
| 数据库名 | `yshop_pro` |
| 用户名 | `root` |
| 密码 | 见 `application-dev.yaml` 中 `spring.datasource.dynamic.datasource.master.password` |
| JDBC URL | 见 `application-dev.yaml` 中 `spring.datasource.dynamic.datasource.master.url` |

> 连接方式：通过 SSH 登录宿主机后，使用 `mysql -h 47.101.64.142 -P 13306 -u root -p yshop_pro` 连接，或从本地通过 `ssh -L` 隧道连接。

---

## yshop（后端）

**基本信息**

| 属性 | 值 |
|------|------|
| 应用名称 | yshop |
| 技术栈 | Java 17 + Maven + Spring Boot |
| 关联服务器 | rprod18 (139.196.173.216) |
| 部署用户 | root |
| 代码路径 | /opt/holun/yshop-drink |
| 启动路径 | /opt/holun/yshop-drink/yshop-server |
| JAR 文件 | yshop-server.jar |

**部署步骤**

```bash
# 1. 拉取最新代码
ssh root@139.196.173.216 "cd /opt/holun/yshop-drink && git pull gitee master"

# 2. 停止旧进程
ssh root@139.196.173.216 "kill \$(ps -ef | grep yshop-server | grep -v grep | awk '{print \$2}')" 2>/dev/null || true

# 3. 打包
ssh root@139.196.173.216 "cd /opt/holun/yshop-drink && mvn clean package -DskipTests"

# 4. 启动服务
ssh root@139.196.173.216 "cd /opt/holun/yshop-drink/yshop-server && nohup java -jar target/yshop-server.jar > /opt/holun/yshop-drink/yshop-server/app.log 2>&1 &"

# 5. 验证服务是否启动
ssh root@139.196.173.216 "ps -ef | grep java | grep yshop-server | grep -v grep"
```

**健康检查**

```bash
# 检查进程存活
ssh root@139.196.173.216 "ps -ef | grep java | grep yshop-server | grep -v grep"

# 检查日志（最近 50 行）
ssh root@139.196.173.216 "tail -n 50 /opt/holun/yshop-drink/yshop-server/app.log"

# 检查端口监听（默认 8080）
ssh root@139.196.173.216 "ss -tlnp | grep 8080"
```

---

## yshop-drink-vue（管理后台）

**基本信息**

| 属性 | 值 |
|------|------|
| 应用名称 | yshop-drink-vue |
| 技术栈 | Vue3 + Vite + pnpm |
| 关联服务器 | rprod18 (139.196.173.216) |
| 部署用户 | root |
| 代码路径 | /opt/holun/yshop-drink-vue |
| 构建输出目录 | `dist/` |
| Nginx 静态资源目录 | `/opt/holun/yshop-drink-vue/dist` |

**部署步骤**

```bash
# 1. 本地构建（在 admin/ 目录下执行）
cd admin && pnpm build:dev

# 2. 上传构建产物到服务器
scp -r admin/dist/* root@139.196.173.216:/opt/holun/yshop-drink-vue/dist/

# 3. 验证文件已上传
ssh root@139.196.173.216 "ls -la /opt/holun/yshop-drink-vue/dist/"
```

> **说明**：`pnpm build:dev` 构建开发环境版本。如需构建生产环境版本，使用 `pnpm build:prod`。

**健康检查**

```bash
# 检查静态资源目录
ssh root@139.196.173.216 "ls -la /opt/holun/yshop-drink-vue/dist/ | head -20"

# 检查 Nginx 服务状态（如已配置）
ssh root@139.196.173.216 "systemctl status nginx"
```

---

## icepolarminiapp（小程序）

> TODO: 待补充

---

## icepolar-dms（设备管理系统）

**基本信息**

| 属性 | 值 |
|------|------|
| 应用名称 | icepolar-dms |
| 技术栈 | Python + FastAPI |
| 关联服务器 | rprod18 (139.196.173.216) |
| 部署用户 | root |
| 代码路径 | /opt/holun/icepolar/icepolar-dms |
| 主服务启动脚本 | /opt/holun/icepolar/icepolar-dms/scripts/start_main.sh |
| 模拟器启动脚本 | /opt/holun/icepolar/icepolar-dms/scripts/start_simulator.sh |
| 启动端口 | 8001 |

**部署步骤**

```bash
# 1. 拉取最新代码
ssh root@139.196.173.216 "cd /opt/holun/icepolar/icepolar-dms && git pull"

# 2. 进入虚拟环境并安装/更新依赖
ssh root@139.196.173.216 "cd /opt/holun/icepolar/icepolar-dms && source venv/bin/activate && pip install -r requirements.txt"

# 3. 停止旧进程
ssh root@139.196.173.216 "kill \$(ps -ef | grep 'start_main.sh' | grep -v grep | awk '{print \$2}')" 2>/dev/null || true
ssh root@139.196.173.216 "kill \$(ps -ef | grep 'uvicorn app.main:app' | grep -v grep | awk '{print \$2}')" 2>/dev/null || true

# 4. 进入虚拟环境并通过启动脚本启动主服务（端口 8001）
ssh root@139.196.173.216 "cd /opt/holun/icepolar/icepolar-dms && source venv/bin/activate && nohup ./scripts/start_main.sh -p 8001 --no-reload > /dev/null 2>&1 &"

# 5. 验证服务是否启动
ssh root@139.196.173.216 "ps -ef | grep 'start_main.sh' | grep -v grep"
```

**健康检查**

```bash
# 检查进程存活
ssh root@139.196.173.216 "ps -ef | grep 'start_main.sh' | grep -v grep"

# 检查日志（最近 50 行）
ssh root@139.196.173.216 "tail -n 50 /opt/holun/icepolar/icepolar-dms/scripts/main.log"

# 检查端口监听
ssh root@139.196.173.216 "ss -tlnp | grep 8001"
```

**模拟器**

```bash
# 启动模拟器（按需）
ssh root@139.196.173.216 "cd /opt/holun/icepolar/icepolar-dms && source venv/bin/activate && nohup ./scripts/start_simulator.sh > /dev/null 2>&1 &"

# 检查模拟器进程
ssh root@139.196.173.216 "ps -ef | grep 'start_simulator.sh' | grep -v grep"

# 检查模拟器日志
ssh root@139.196.173.216 "tail -n 50 /opt/holun/icepolar/icepolar-dms/scripts/simulator.log"
```

---

## 通用规则

1. **测试优先** — 任何变更必须先部署到测试环境验证通过
2. **禁止高峰期部署** — 生产环境部署需避开业务高峰时段
3. **保留回滚能力** — 部署前备份当前运行的 JAR/构建产物
4. **部署后验证** — 检查进程、日志、端口、关键 API 响应
5. **凭证管理** — 禁止在脚本中硬编码密码或密钥，使用 SSH key 或环境变量注入
