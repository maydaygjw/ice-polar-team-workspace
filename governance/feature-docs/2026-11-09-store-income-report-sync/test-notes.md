# 测试备注 — 店铺收入报表独立数据源与打款指标

## 编译与类型检查

- 通过：`(cd .worktrees/backend-store-income-report-sync && mvn -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests compile)`。
- 未通过：`(cd .worktrees/admin-store-income-report-sync && pnpm ts:check)`；worktree 未安装 `node_modules`，`vue-tsc` 不存在。未自动安装依赖。
- 未运行自动化测试和 E2E；后续按 [`test-plan.md`](test-plan.md) 执行。
