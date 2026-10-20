# 活动报名管理画像展示契约变更

## 管理后台报名分页响应

`GET /admin-api/activity/registration/page` 在现有报名记录响应中新增：

| 字段 | 类型 | 可空 | 说明 |
|---|---|---|---|
| `prizeNames` | string[] | 否 | 当前报名所属期次的奖品名称，按期次奖品排序；没有奖品时返回空数组 |
| `userStage` | string | 是 | 当前租户内关联会员的最新用户画像阶段编码；未关联会员或没有画像时为空 |

期次奖品来自该期次已保存的奖品快照。用户阶段通过会员的 `externalUserId` 关联最新用户画像，沿用画像数据的当前租户隔离。该接口仅查询并展示信息，不改变报名、抽奖或兑奖行为。

管理端在报名记录表格中展示奖品名称和用户阶段；用户阶段编码显示为：`new` 新用户、`high_frequency` 高频用户、`occasional` 偶尔下单、`at_risk` 流失中、`churned` 已流失。未知或空编码显示为 `-`。

## 内部会员 API

会员批量查询 `MemberUserApi.getUsers(ids)` 的 `MemberUserRespDTO` 新增可空 `userStage`，按当前租户关联会员 `externalUserId` 返回其最新用户画像阶段。此字段仅供服务端内部模块复用，不改变会员管理 HTTP API。
