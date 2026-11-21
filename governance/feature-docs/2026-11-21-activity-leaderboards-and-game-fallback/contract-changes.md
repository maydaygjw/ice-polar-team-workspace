# 活动排行榜与游戏兜底奖励契约变更

## App API

新增公开只读接口：

```http
GET /app-api/activity/period/game-leaderboard?periodId={periodId}
```

- 仅适用于 `drawMode=3` 的期次，不要求登录。
- 按最佳已完成游戏成绩返回最多 10 条：最高通过关数降序、耗时升序、完成时间升序、报名 ID 升序。
- 响应包含 `periodId`、`entries`；每项包含 `rank`、服务端脱敏 `displayName`、`highestPassedLevel`、`durationMillis` 和 `finishedAt`。
- 不返回用户 ID、手机号、openid、企业微信 UserID、兑奖码或报名 ID。报名 ID 仅用于服务端稳定排序。
- 查询显式校验期次及租户归属；非游戏期次不得返回榜单。

开奖名单继续使用现有 `GET /app-api/activity/period/winners?periodId={periodId}`。H5 在现有已排序的名单中展示前 10 条，不改变该接口契约。

## Admin API

- 游戏模式模板创建、更新请求允许使用现有可选 `fallbackPrizeId`。
- 模板详情和分页响应继续返回 `fallbackPrizeId`、`fallbackPrize` 只读奖品摘要。
- 兜底奖不得与三关常规奖品重复引用；奖品仍须属于当前租户、有效且可用。
- 兜底奖不进入 `prizes[]`，不提交数量、概率或排序。

## Game Settlement

- 每期游戏快照包含可选兜底奖快照。
- 终局先按现有规则选择最高已通过关卡的奖品。常规奖可发时保持现有结算；无有效常规奖或库存不足时，如有兜底奖则以兜底快照写入现有中奖记录。
- 已满足单人限中时不生成第二条中奖记录；兜底奖不绕过限中。
- 兜底中奖仍返回现有 `winner` 摘要，兑奖继续使用现有 `winnerId` 接口。

## Game Ranking Persistence

活动报名表增加当前局开始时间及最佳成绩字段，用于服务端计时和期次榜单查询；字段必须租户隔离，并通过 Flyway migration 增量添加。历史报名字段为空时不进入游戏榜。

最佳成绩包含最高通过关数、对应局耗时和完成时间。新局开始时间与当前局状态在服务端持久化；终局事务内维护最佳成绩。相同 `requestId` 重放不得重复更新时间或成绩。

## Compatibility

- 不改变历史模板、已生成期次和用户历史中奖记录。
- 现有 DRAW/LOTTERY 快照与结算不变；现有游戏期次继续按原来配置结算。
- 不修改用户端中奖名单接口和中奖记录兑奖语义。
