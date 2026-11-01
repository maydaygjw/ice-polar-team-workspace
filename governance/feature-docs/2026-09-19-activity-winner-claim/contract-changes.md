# 活动中奖记录兑奖

## 目标

开奖阶段只生成中奖记录，不执行奖品的开奖规则副作用。管理后台在确认兑奖时调用期次奖品快照对应的开奖规则，避免开奖和实际发放混在一起。

## 中奖记录字段

- `status` 继续表示中奖记录有效性：`1` 有效，`0` 无效。
- `claimStatus` 表示兑奖状态：`0` 待兑奖，`1` 已兑奖，`2` 处理中。
- `claimTime` 表示成功兑奖时间；待兑奖时为 `null`。
- 管理端批量兑奖有界并行处理；每条记录独立提交兑奖状态，不使用覆盖整批的事务。外部调用结果不确定时保留 `claimStatus=2`，需先核实外部履约结果，不能直接重试。

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

三类接口均需要 `activity:winner:claim` 权限。已确认失败的规则执行将记录恢复为待兑奖；外部调用超时、响应异常或最终状态写入失败等结果不确定的情况保留处理中以避免重复履约。批量接口逐条独立处理，单条失败不影响其他记录，并在 `failedWinnerIds` 中返回失败记录。

## 用户端接口

- `POST /app-api/activity/period/claim?winnerId=20001`：要求登录，只能兑奖当前登录用户自己的中奖记录。有效待兑奖记录执行该中奖记录对应的奖品规则；成功返回 `true`，已兑奖记录幂等返回 `true`。自动发放规则执行失败返回业务错误，记录保持 `claimStatus=0`，允许重试；处理中记录不可并发重复执行。线下兑奖规则不通过该接口自动核销，返回“线下奖品无法自动兑奖，请联系企业微信客服兑奖”，记录保持待兑奖。
- `GET /app-api/activity/period/my-result?periodId=123`：顶层首条中奖信息及 `winners[]` 每条中奖记录均返回 `claimStatus`（0 待兑奖、1 已兑奖、2 处理中）、`claimTime` 和 `offlineClaim`。即时抽奖 `/draw` 返回的中奖信息也包含这些字段。H5 对 `offlineClaim=true` 的记录提供联系企业微信客服兑奖入口。
