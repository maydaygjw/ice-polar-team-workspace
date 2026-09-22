# 活动抽奖模式验证记录

## 已执行

- `cd .worktrees/backend-activity-lottery-mode && mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile`：通过。
- `cd .worktrees/backend-activity-lottery-mode && mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：通过；活动模块及依赖测试共 15 项通过。
- `cd .worktrees/admin-activity-lottery-mode && pnpm exec eslint src/api/activity/index.ts src/views/activity/index.vue src/views/activity/period/index.vue`：通过。
- `cd .worktrees/admin-activity-lottery-mode && pnpm build:dev`：通过。
- `cd .worktrees/admin-activity-lottery-mode && NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`：失败，仓库基线存在大量全局自动导入/类型声明错误，例如 `ExpressPageReqVO`、`PageReqVO`、`ref`、`computed` 等未定义；过滤本次修改的 activity 文件未发现对应错误。

## 尚未执行

- 真实数据库升级脚本执行和回滚演练：需要可用的活动测试库。
- 登录态 app-api 端到端抽奖：本期未修改 miniapp，需后续客户端接入或使用 API 测试工具验证。
- 并发库存和幂等压力测试：需要可运行的 backend、MySQL 和测试数据。

## 测试环境部署与 API 冒烟

| 项目 | 结果 |
|---|---|
| 环境 | test，2026-09-22 21:38–21:41（Asia/Shanghai） |
| Backend commit | `25f2edd184592a13517298eeafce100b920fa9b3` |
| Backend JAR SHA-256 | `5ec81daabfd3c4c54d7dc33c1e4e9026fbb95538099f1cf32f776bbfd733bada` |
| 运行 profile / Java | `dev` / Java 17.0.20 |
| 运行端口 | 8888，监听正常 |
| 回滚备份 | `/opt/holun/yshop-drink/yshop-server/target/yshop-server.jar.bak.20260922213830` |

- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am -Dtest=ActivityRegistrationServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：2 项通过。
- `bash governance/SCRIPTS/deploy-backend-test.sh`：干净构建、制品 commit/SHA-256 校验、备份、替换和健康检查均通过；健康检查在 110 秒后通过。
- `GET /`：无认证返回 `code=401`。
- `GET /admin-api/system/auth/get-permission-info`，测试租户 153、Mock Token `test1`：返回 `code=0`。
- `POST /app-api/activity/period/draw`，`periodId=null`：返回参数校验错误 `code=400`。
- `POST /app-api/activity/period/draw`，不存在的 `periodId=999999999`：返回 `code=1009000003`（活动期次不存在）。
- 本次 API 冒烟未创建、修改或消耗业务数据，无需清理。
