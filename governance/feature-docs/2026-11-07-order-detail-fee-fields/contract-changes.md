# 后台订单详情展示平台餐盒费抽成与服务费

## 管理后台 API

`GET /admin-api/order/store-order/get?id={id}` 与 `GET /admin-api/order/store-order/getInfo?orderId={orderId}` 的 `StoreOrderRespVO` 新增只读金额字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `boxFeeForPlatform` | Decimal | 平台餐盒费抽成 |
| `serviceFee` | Decimal | 订单服务费 |

两个字段暂不由下单或支付流程赋值。数据库字段默认 `0.00`，后台订单详情展示字段值。原 `boxFeePrice` / `box_fee_price` 继续表示餐盒费。

## 数据库

迁移 `V2026110702__store_order_platform_fees.sql` 在 `yshop_store_order` 新增 `box_fee_for_platform` 与 `service_fee` 两个 `decimal(12,2) NOT NULL DEFAULT 0.00` 字段。
