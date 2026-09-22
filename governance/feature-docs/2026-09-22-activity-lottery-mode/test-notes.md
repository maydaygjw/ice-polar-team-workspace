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
