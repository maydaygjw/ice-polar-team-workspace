# 活动管理验证记录

## 已执行

- `pnpm i --frozen-lockfile`（admin 工作树）：通过。
- `pnpm exec eslint src/api/activity/index.ts src/views/activity/index.vue`：通过。
- `(cd backend-worktree && mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile)`：通过。
- `pnpm exec eslint src/api/activity/index.ts src/views/activity/index.vue src/views/activity/period/index.vue`（admin 工作树）：通过。
- backend 已从最新 `master` 合并 Checkstyle 配置；`mvn -pl yshop-module-activity/yshop-module-activity-biz -am -Pcheckstyle -DskipTests verify`：通过。新模块当前输出规范报告但不阻断构建，与主分支 mp 模块策略一致。
- 按要求 activity 模块已切换为 `failOnViolation=true`；当前 Checkstyle 会阻断构建，尚有 226 条 activity/既有 mp-api 规范告警待清理。
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`：项目全量检查返回失败；当前基线存在大量与活动无关的自动导入/类型错误，新增活动文件未出现在剩余错误中。

## 未执行

- 数据库迁移集成测试：需要可用 MySQL 测试实例。
- 报名/开奖/二维码 API 测试：需要可用租户、会员与本地企微数据。
- Admin E2E：需要启动 backend、admin 和登录环境。

## 审查结论

- backend 活动模块编译通过；admin 活动新增文件定向 lint 通过。
- 社群成员校验需在本地企微群成员快照字段稳定后补充精确匹配；当前开启时阻止报名，避免误放行。
- migration 按当前基线营销父菜单 `system_menu.id=2030` 编写，执行前需在目标库确认。
