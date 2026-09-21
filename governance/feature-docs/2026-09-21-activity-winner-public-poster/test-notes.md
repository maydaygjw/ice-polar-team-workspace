# 活动中奖公示长图测试记录

## 计划

- 后端单元/集成测试：租户隔离、有效记录过滤、排序、100 条截断、脱敏展示名和空数据。
- 管理端类型检查和生产构建。
- 手工核对 0、1、100、101 条记录的海报高度、内容和下载文件名。

## 执行结果

- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`: pass；活动模块及依赖测试全部通过，活动模块 15 个测试通过。
- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am -Dtest=ActivityWinnerPublicPosterServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass；管理端和 app-api 的 100 条截断、脱敏兜底单元测试通过。
- `pnpm build:prod`: pass；管理端生产构建成功。
- `pnpm exec prettier --check src/api/activity/index.ts src/views/activity/record/winner.vue`: pass。
- `pnpm exec eslint src/api/activity/index.ts src/views/activity/record/winner.vue`: pass。
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`: fail；仓库基线存在大量自动导入和类型声明错误，本次新增文件未出现在错误列表中。
- H5 `pnpm type-check`: pass。
- H5 `pnpm build`: pass；H5 生产构建成功。
- 未执行真实页面手工/端到端验证：当前未启动带活动测试数据的管理端和后端环境。
