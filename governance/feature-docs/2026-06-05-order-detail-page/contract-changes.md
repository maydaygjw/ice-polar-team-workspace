# Order Detail API Contract Changes

## Feature

Order Detail Page — MiniApp 订单详情展示

## API

- `GET /app-api/order/detail/{key}` — 查询订单详情

`key` 可为以下任一值：
- `orderId`
- `unique`
- `extendOrderId`

## Response

响应主体为 `AppStoreOrderQueryVo`，MiniApp 订单详情页依赖以下字段：

| 字段 | 说明 |
|------|------|
| `orderId` | 订单号 |
| `unique` | 订单唯一标识，支付/退款等操作复用 |
| `statusDto` | 订单展示状态 |
| `cartInfo` | 商品明细列表 |
| `shopName` | 门店名称 |
| `payType` | 支付方式 |
| `totalPrice` | 商品总价 |
| `payPrice` | 实付金额 |
| `couponPrice` | 优惠券抵扣金额 |
| `deductionPrice` | 会员等优惠抵扣金额 |
| `boxFeePrice` | 餐盒费 |
| `createTime` | 下单时间 |
| `payTime` | 支付时间 |
| `refundStatus` | 退款状态 |
| `refundReasonWapExplain` | 退款说明 |
| `refundReasonWapImg` | 退款凭证图片 |
| `mark` | 用户备注 |
| `remark` | 商家备注 |

## Permission Rule

- 必须登录访问（`@PreAuthenticated`）

## Contract Version

- Initial version — extracted from `CONTRACTS.md` during contract doc layering refactor
