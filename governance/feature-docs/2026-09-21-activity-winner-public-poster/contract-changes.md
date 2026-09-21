# 活动中奖公示长图契约变更

## API

新增管理端接口：

```http
GET /admin-api/activity/winner/public-poster-data?periodId={periodId}
```

权限：`activity:winner:query`。

成功响应：

```json
{
  "activityTitle": "周末幸运抽奖",
  "periodNo": "20260921-01",
  "drawTime": "2026-09-21T18:00:00",
  "backgroundImage": "https://...",
  "totalWinnerCount": 156,
  "winnerCount": 100,
  "truncated": true,
  "prizes": [
    {
      "prizeName": "一等奖",
      "prizeImage": "https://...",
      "winners": ["张**", "李**"]
    }
  ]
}
```

接口只返回当前租户、当前期次、有效中奖记录；按照奖品顺序、中奖时间、中奖记录 ID 排序后最多取 100 条。`truncated` 表示有效中奖总数超过 100。展示名由服务端脱敏，响应不得包含兑奖码、用户 ID、openid、完整手机号或企业微信 UserID。

无有效中奖记录返回成功响应但 `winnerCount=0`，前端展示“暂无可公示的中奖记录”且不下载文件。期次不存在、跨租户或无数据权限沿用现有资源/权限错误语义。

新增用户端接口：

```http
GET /app-api/activity/period/winners?periodId={periodId}
```

无需登录。成功响应：

```json
{
  "periodId": 123,
  "periodNo": "20260921-01",
  "activityTitle": "周末幸运抽奖",
  "drawTime": "2026-09-21T18:00:00",
  "totalWinnerCount": 156,
  "winnerCount": 100,
  "truncated": true,
  "winners": [
    {
      "prizeName": "一等奖",
      "prizeImage": "https://...",
      "displayName": "张*",
      "winnerTime": "2026-09-21T18:00:01"
    }
  ]
}
```

用户端响应不得包含原始昵称、手机号、用户 ID、openid、企业微信 UserID、兑奖码或内部中奖记录 ID。展示名由服务端脱敏；接口只返回有效中奖记录，按奖品顺序、中奖时间、记录 ID 排序后最多 100 条。

## DB

N/A：复用 `yshop_activity_period_snapshot`、`yshop_activity_period_prize`、`yshop_activity_winner` 和会员资料，不新增表或字段。

## 权限与数据范围

管理端接口复用 `activity:winner:query`；用户端接口无需登录。两类接口都必须执行当前租户隔离，并遵循活动期次已有数据范围。

## 兼容性

新增只读接口，不改变现有分页、Excel 导出、兑奖、通知和活动详情接口。
