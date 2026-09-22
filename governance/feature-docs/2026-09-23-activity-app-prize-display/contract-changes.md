# 活动用户端奖品展示契约变更

## App API

用户端活动期次详情接口保持路径和业务语义不变：

- `GET /app-api/activity/period/detail`
- `GET /app-api/activity/period/latest`

响应中的 `data.prizes[]` 仅返回用户端需要展示和抽奖结果关联的字段：

```json
{
  "id": 10001,
  "sort": 1,
  "prizeName": "6元优惠券",
  "image": "https://oss.example/prize.png",
  "claimInstruction": "凭中奖记录到店核销"
}
```

用户端奖品响应不再返回以下字段：

- `quantity`
- `winnerQuantity`
- `probability`

上述库存、已中奖数量和中奖概率仍保留在后端期次数据及抽奖算法中，仅不对用户端详情接口暴露。管理端奖品配置和抽奖规则接口不变。

## Compatibility

- H5 不再展示奖品数量、已中奖数量和概率文本。
- 中奖结果接口中的 `winner.prizeName`、`winner.prizeImage` 和 `claimInstruction` 保持不变。
- 不修改数据库字段，不影响库存扣减、概率计算和中奖记录。
