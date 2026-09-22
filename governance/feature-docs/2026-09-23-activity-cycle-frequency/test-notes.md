# 测试记录

## 已执行

- `backend`: `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`
  - 结果：通过，活动模块测试 20 项，无失败。
  - 新增覆盖：按天当天生成、结束后顺延下一天、按天第 3 期逐日递增、按周兼容行为。
- `backend`: `mvn -pl yshop-module-activity/yshop-module-activity-biz -am -Dtest=ActivityPeriodServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`
  - 结果：通过，周期日期测试 4 项，无失败；补充覆盖抽奖模式按报名结束时间顺延。
- `admin`: `pnpm exec eslint src/api/activity/index.ts src/views/activity/index.vue`
  - 结果：通过。
- `admin`: `pnpm build:dev`
  - 结果：通过；仅有仓库既有 Sass 弃用告警。
- `admin`: `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`
  - 结果：未通过，仓库基线存在大量既有类型错误；活动页唯一相关错误为原有开奖时间 `string | null` 与 Element Plus 类型不匹配，不由本次周期改动引入。

## 未执行

- 未连接测试环境执行真实管理端保存和生成期次流程。
- 未执行数据库迁移；本次仅提供迁移脚本。
