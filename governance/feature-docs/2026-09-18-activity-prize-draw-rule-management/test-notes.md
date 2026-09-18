# 测试记录

## backend

- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：通过。
- 结果：activity 模块测试 6 个通过，0 失败，0 错误。
- 覆盖：既有订单外部调用测试，以及积分/余额开奖规则空壳参数校验。

## admin

- `pnpm install --frozen-lockfile`：通过。
- `pnpm build:test`：通过，生成 `dist-test`。
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`：未通过，仓库已有全局自动导入和类型声明错误；过滤 `src/api/activity`、`src/views/activity` 后未发现本次改动新增错误。

## 未执行

- 未执行数据库迁移和真实接口 E2E：当前 worktree 未连接 test 数据库，且用户尚未要求部署。
- 未验证菜单 SQL 在真实数据库中的执行结果。
