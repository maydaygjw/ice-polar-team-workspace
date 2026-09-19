# 活动中奖记录兑奖

## 目标

开奖阶段只生成中奖记录，不执行奖品的开奖规则副作用。管理后台在确认兑奖时调用期次奖品快照对应的开奖规则，避免开奖和实际发放混在一起。

## 中奖记录字段

- `status` 继续表示中奖记录有效性：`1` 有效，`0` 无效。
- `claimStatus` 表示兑奖状态：`0` 待兑奖，`1` 已兑奖，`2` 处理中。
- `claimTime` 表示成功兑奖时间；待兑奖时为 `null`。

历史记录迁移后标记为 `claimStatus=1`，并将 `claimTime` 设为原中奖时间；旧版本已在开奖时执行过规则，不能再次发放。

## 管理后台接口

- `POST /admin-api/activity/winner/claim`
  - 请求：`{"winnerId": 20001}`
  - 只处理当前租户、有效且待兑奖的中奖记录；成功后返回 `true`。
- `POST /admin-api/activity/winner/claim-batch`
  - 请求：`{"winnerIds": [20001, 20002]}`
  - 逐条处理当前租户、有效且待兑奖的中奖记录；已兑奖记录幂等跳过。
  - 返回 `{total, successCount, skippedCount, failedCount, failedWinnerIds}`。
- `POST /admin-api/activity/period/claim-winners`
  - 请求：`{"periodId": 123}`
  - 对当前租户该期次的有效待兑奖记录执行批量兑奖，返回同上批量结果结构。

三类接口均需要 `activity:winner:claim` 权限。规则执行失败的记录保持待兑奖，批量接口不因单条失败回滚其他已成功的外部发放动作，并在 `failedWinnerIds` 中返回失败记录。
