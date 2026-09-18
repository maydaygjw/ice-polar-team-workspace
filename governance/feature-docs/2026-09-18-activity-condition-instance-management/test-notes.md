# 测试记录

## 已执行

- `(cd backend && mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile)`：通过。
- `(cd backend && mvn -pl yshop-module-activity/yshop-module-activity-biz -am -Dtest=WxappOrderClientTest -Dsurefire.failIfNoSpecifiedTests=false test)`：通过，3/3。
- `(cd admin && pnpm exec eslint src/views/activity/condition/index.vue src/views/activity/index.vue src/api/activity/index.ts)`：通过。
- `(cd admin && pnpm build:dev)`：通过；仅有仓库既有 Sass/Vite 弃用告警。
- `(cd admin && NODE_OPTIONS=--max-old-space-size=8192 pnpm run ts:check)`：本次活动页面/API无类型错误；命令仍因其他系统页面既有类型错误退出非 0。

## 待执行

- 条件实例 CRUD API：新增、编辑、启停、删除、租户隔离、模板引用阻断。
- 条件模板链路：同一类型多个实例选择、重复引用校验、停用实例阻断。
- 测试环境迁移和后台 E2E：需要提交并部署 backend/admin 后执行。

## 已知限制

- 全量 `vue-tsc` 受仓库其他模块既有类型错误影响，未作为本次功能通过门禁；本次改动文件无类型诊断，并已通过 ESLint 和 Vite 构建。
