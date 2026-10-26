# 活动推荐阶梯奖励实现记录

## 变更范围

- backend：模板新人/普通推荐阶梯持久化和校验、期次奖品规则快照、首次参加标记、期次推荐进度和奖励记录、用户端进度/奖励查询、自助兑奖扩展、后台推荐奖励分页查询及数据库迁移。
- admin：活动模板向导新增最后一步推荐奖励配置；期次页增加推荐奖励记录查看入口。
- H5：活动期次显示推荐规则；登录用户可查看本期推荐进度、达档奖励并发起自助兑奖。
- miniapp：不在本期范围。

## 实现约束

- 原 `inviteRegistrationChance` 配置和机会发放路径保持独立。
- 推荐奖励库存仅更新期次推荐阶梯的 `issued_quantity`，不改开奖库存。
- 推荐记录查询和兑奖均按当前租户及登录用户限制。
- 数据库迁移新增五张业务表，并按成功报名记录回填模板首次参加标记。

## 验证

- backend：`mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile` 通过。
- H5：`pnpm type-check`、`pnpm build` 通过。
- admin：`pnpm build:dev` 通过；`pnpm ts:check` 因仓库范围内已有大量类型错误失败（包括缺少全局类型与无关页面类型错误），按修改文件过滤未发现本次改动文件的类型错误。
- 未执行自动化测试。
