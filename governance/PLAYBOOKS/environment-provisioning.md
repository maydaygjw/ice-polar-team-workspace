# 环境初始化手册

供新服务器或新环境首次启用使用。日常测试部署见 [测试流水线手册](test-environment-pipeline-deployment.md)，生产操作边界见 [生产发布与交接](deployment.md)。

## 基础设施

- 从 workspace 根目录使用 `governance/SCRIPTS/deploy-helper.sh` 的 `load_env <环境>` 加载目标；主机、域名、目录和端口统一维护在 `governance/ENVIRONMENTS/`，不在本手册复制环境清单。
- 配置部署用户、SSH key、时区与时间同步、防火墙和必要的网络白名单。
- MySQL、Redis 使用外部服务；应用侧仅按需提供客户端，确认连通性和最小访问权限。
- 按部署方式准备运行时：后端 Java 17，DMS/Mock Python 版本以各仓库要求为准；容器部署验证镜像内运行时。Maven、Node、pnpm 等构建工具仅部署在构建执行环境。
- 配置凭据来源、持久化目录、日志轮转、监控和备份恢复机制；秘密不进入 Git 或构建日志。

## 应用与入口

| 应用 | 初始化要求 |
|---|---|
| 后端 | 明确容器或进程托管方式、自动恢复策略、profile、端口及外部依赖；生产显式使用 `prod` |
| 管理后台 / H5 | 准备静态资源目录或镜像、Vue Router history fallback、API 路由；H5 同时验收首页与 `activity.html`，生产关闭测试登录 |
| DMS | 按 `.gitmodules` 确认仓库；固定版本和依赖、隔离运行环境、配置数据库及后端访问，禁止生产热重载 |
| 网关 / Nginx | 配置域名到应用的映射、HTTPS 证书及跳转；已有网关负责 TLS 时沿用其职责，不重复配置 |

数据库初始化或迁移单独纳入变更流程，不作为应用启动的隐含步骤。Nginx 配置须通过 `nginx -t`；生产应用配置由人工按审批流程生效。

## Mock 服务

仅用于受控测试环境，首次初始化前确认目标仓库版本已推送：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env dev
bash governance/SCRIPTS/provision-mock-external-server.sh
```

核对脚本目标与实际后端所在环境。默认仅监听回环地址、关闭管理接口；后端地址必须在其网络命名空间内可达。Mock 不属于生产发布流程。

## 验收与交接

按 [诊断手册](incident-response.md) 验证域名到实际实例及数据源的完整链路，检查运行时、自动恢复、日志、依赖连通性和健康接口。记录环境元数据与受控配置来源，再进入对应发布流程；不得用代码目录或宿主机默认运行时替代实际实例验证。
