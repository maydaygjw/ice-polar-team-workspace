# Production Deployment Playbook

> 测试环境部署见 [`test-environment-pipeline-deployment.md`](test-environment-pipeline-deployment.md)。本文只处理生产发布。

## 发布前

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env prod
```

- 已完成测试环境验证，并获得明确生产授权。
- 记录批准的源码 commit、制品 SHA-256、配置来源和回滚版本。
- 不在生产构建、下载依赖、执行数据库迁移或写入秘密。
- 数据库迁移、数据修复、凭据轮换、Nginx/防火墙变更须单独授权。

## 发布

- 后端：上传测试验证过的同一 JAR，校验 SHA-256 和内嵌 commit，备份旧 JAR，重启 `yshop.service`，检查 JDK 17、`prod` profile、端口、健康接口和日志。
- 管理后台：上传测试验证过的同一 `dist` 制品，备份旧目录，执行 `nginx -t && systemctl reload nginx`。
- H5：在本地使用生产 API 和租户配置构建，上传制品到 `yprod1`，备份旧目录，执行 Nginx 检查和 reload；生产关闭测试登录。
- DMS：使用固定 commit、锁定依赖和 `--no-reload`，由 systemd 或等价进程管理器托管。

生产不得重新构建或手工修改制品。发布后检查服务状态、监听端口、日志、域名、静态资源和关键业务链路。

## 回滚

发布失败时停止服务或切换流量，恢复最近一次备份制品，重新执行配置检查、服务启动和健康验收，并记录失败版本、SHA-256、证据与结果。
