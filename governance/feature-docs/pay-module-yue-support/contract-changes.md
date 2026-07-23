# Contract Changes: pay-module-yue-support

## API

### MemberUserApi 新增方法

```java
// 扣减用户余额（原子操作，Mapper 层 UPDATE SET now_money = now_money - ? WHERE id = ?）
void decPrice(Long uid, BigDecimal price);

// 增加用户余额
void incMoney(Long uid, BigDecimal price);
```

调用方：`YuePayService`（`yshop-module-pay-biz`）
实现方：`MemberUserApiImpl`（`yshop-module-member-biz`）

### PayOrderApi 行为变化

`createPayOrder(PayOrderCreateReqDTO)` 新增 YUE 分支：
- 返回 `PayOrderRespDTO.tradeType = "YUE"`、`data = 空 Map`
- 余额不足时抛异常：错误码含「余额不足」

`refund(PayRefundReqDTO)` 新增 YUE 分支：
- 余额退款成功返回 `true`
- `PayRefundReqDTO.orderId` 作为业务单号，不查 `pay_out_order_no` 表

## DB

N/A: 无 schema 变更。余额存储在 `yshop_user.now_money`，由 member 模块管理。

## MQ

N/A: 余额支付不需要 MQ 回调（区别于微信/支付宝）。

## Permissions

N/A: 余额支付复用现有 C 端鉴权（`@PreAuthenticated`），不引入新权限码。

## Dependencies

N/A: `yshop-module-pay-biz` 已有 `yshop-module-member-api` 依赖，无需新增。
