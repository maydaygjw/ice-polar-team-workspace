# 活动中奖批量通知契约变更

## Admin API

统一前缀 `/admin-api/activity`，响应使用现有 `CommonResult`，要求登录、租户隔离和现有 `activity:winner:claim` 权限。原单条通知接口保持兼容。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/winner/send-notification-batch` | 按中奖记录 ID 批量创建企业微信中奖通知任务 |

请求体：

```json
{"winnerIds":[20001,20002]}
```

响应体：

```json
{
  "total": 2,
  "successCount": 1,
  "failedCount": 1,
  "failedWinnerIds": [20002]
}
```

`winnerIds` 必填且不能为空，服务端会去重，并先按相同会员 ID 汇总奖品，再按完全相同的消息内容聚合。企业微信客户消息 API 会继续按实际可用的跟进成员和企业微信账号分组，将同一消息内容、同一发送人的多个客户放入同一个 `external_userid` 列表，一次创建群发任务，发送人只需点击一次发送。单条记录校验失败不会阻断其他分组，失败记录通过 `failedWinnerIds` 返回，并将对应中奖记录的 `notificationStatus` 记录为 `2`；发送成功的记录记录为 `1`，未发送记录为 `0`。重复操作会创建新的企业微信消息任务。
