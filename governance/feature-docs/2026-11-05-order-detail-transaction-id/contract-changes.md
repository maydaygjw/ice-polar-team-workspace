# 订单详情支付流水号契约变更

## API

管理后台订单详情响应增加可选字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `transactionId` | string \| null | 支付渠道返回并保存在订单记录中的支付流水号；未记录时为 `null`。 |

适用接口：

- `GET /admin-api/order/store-order/get?id={id}`
- `GET /admin-api/order/store-order/getInfo?orderId={orderId}`

字段只读，来源为订单记录 `transaction_id`。不改变订单支付、权限、租户隔离或数据库结构。
