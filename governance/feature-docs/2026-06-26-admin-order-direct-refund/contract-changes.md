# 契约变更 — 后台直接退款

## 端点行为变更（非新增）
`POST /order/store-order/cancelAndRefund?id=`

| 项 | 变更前 | 变更后 |
|----|--------|--------|
| 适用订单状态 | 仅未发货（`status==0`） | 已支付未退款的**任意发货状态** |
| 入参 / 返回 | Query `id: Long` / `CommonResult<Boolean>` | 不变 |
| 权限 | `order:store-order:update` | 不变 |
| 行为 | 全额退款 + `status=-2` + `refundStatus=2` | 不变 |

变更点：移除「订单已发货或已完成，无法取消退款」(`ErrorCode 202507011`) 的拦截。

### 错误码（复用现有）
- `STORE_ORDER_NOT_EXISTS` — 订单不存在
- `ORDER_STATUS_ERROR` — 订单未支付
- `ORDER_REFUNDED` — 订单已退款

## 未新增
不新增 `adminRefund` 端点；前端「退款」「取消并退款」均调用 `cancelAndRefund`。

## 兼容性
- 该端点唯一调用方为 admin 控制器。
- 前端「取消并退款」入口仍仅在未发货订单显示，既有行为不变。
- 新增「退款」入口在非未发货的已支付未退款订单显示。
