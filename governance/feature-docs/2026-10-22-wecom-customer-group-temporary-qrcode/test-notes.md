# 测试记录

后端 `mp-biz`、`message-biz` 和 `order-biz` 编译通过。管理端 `vue-tsc --noEmit` 仍因仓库现有错误失败（1661 条）；本次新增/修改 API 文件和群列表新增代码行无类型错误，群列表未修改区域仍有 4 条类型错误。单元测试未新增或运行。

实现后至少验证：

- 创建接口的权限、租户隔离、群不存在和企业微信失败场景。
- Redis 延迟任务的 1 小时调度、租户上下文恢复、删除成功、配置已删除幂等处理、失败重试及最终失败告警。
- 前端二维码展示、下载、加载态和错误提示。
- 后端目标模块测试与管理端类型检查/构建。

## 2026-10-22 dev 部署验收

- Backend commit `1fbdd002`：云效流水线 `1408445` / run `110` 的 Maven 编译打包阶段成功；后续“从 OSS 下发 Docker Compose 文件”阶段失败，失败作业为“从 OSS 下载 compose 文件”。流水线返回通用错误 `deploy.fail`。查询任务日志接口返回 HTTP 403，未能取得更具体的部署日志，因此 backend 新版本未确认部署。
- Admin commit `571c449`：云效流水线 `1409672` / run `39` 构建与部署阶段均成功。
- dev 验收：`/actuator/health/` 返回 `UP`；admin 首页、当前引用的 JS/CSS 和图标资源返回 HTTP 200；H5 首页和 `/activity.html` 返回 HTTP 200。
- Playwright `specs/main/login.spec.ts`：2 项通过，成功登录用例失败，页面停留在 `/login`；尚不能确认是测试账号、认证配置还是环境问题。
- 因 backend 部署阶段失败，未执行新二维码接口和 Redis 延迟清理的 dev 联调验收；待 backend 部署问题解决后复测。

## 2026-10-24 dev 部署复验

- Backend commit `3b20bf85`：云效流水线 `1408445` / run `111` 的 Maven 编译打包阶段成功；“从 OSS 下发 Docker Compose 文件”阶段失败，作业结果为 `deploy.fail`。部署详情接口无法读取（HTTP 404），未取得具体失败原因。
- 实际运行版本：`https://api-yshop-dev.holuntech.cn/actuator/info` 返回 commit `3b20bf8596f29afebd46288c60153d24e9bed0e3`、branch `master`、`dirty=false`，与待部署提交一致；`/actuator/health/` 返回 `UP`。
- Admin 首页、H5 首页和 `/activity.html` 均返回 HTTP 200。
- 因流水线部署阶段失败且缺少可用测试账号，本次未通过界面调用群二维码接口验证复用和 Redis 延期清理。该行为仍需在 dev 登录后完成联调验收。
