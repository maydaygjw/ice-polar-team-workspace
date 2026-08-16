# 契约变更：手工触发应收应付结算

## 管理端 API

| Method & Path | 权限 | 语义 |
|---|---|---|
| `POST /admin-api/pay/receivable-payable/settle?id={id}` | `pay:receivable-payable:settle` | 对指定应收应付记录幂等创建并执行 Adapay 分账。 |

请求只接受应收应付主记录 `id`，租户从当前登录上下文解析。返回 `Boolean`：`true` 表示本次已成功完成或已处于幂等完成状态，`false` 表示当前记录不满足执行条件或外部执行失败。

结算前必须读取关联 `yshop_store_order.refund_status`：`1`（退款中）和 `2`（已退款）均不满足结算条件，返回 `false`，不得创建或执行 AdaPay 分账。

`GET /admin-api/pay/receivable-payable/page` 的每条记录增加 `refund_status` 字段，取值沿用订单退款状态：`0` 未退款、`1` 退款中、`2` 已退款、`3` 退款已拒绝。管理端对 `refund_status=1/2` 的记录禁用结算操作，并展示退款状态。

## 内部 API

`BillingSettlementApi` 新增：

```java
boolean settle(Long receivablePayableOrderId);
List<Long> listPendingSettlementIds(LocalDateTime beforeTime, int limit);
boolean fallback(Long receivablePayableOrderId);
```

该方法只允许 `SUCCESS` / `SUCCESS_WITH_DIFFERENCE` 且关联订单未处于退款中/已退款状态的记录进入 AdaPay 适配；计算失败、非 Adapay、缺少已支付 payment ID 或主体收款人不可用时返回 `false`。

`listPendingSettlementIds` 同样只返回关联订单 `refund_status=0` 的记录，退款中的订单不得被日终任务自动结算。

## 权限

在应收应付菜单下新增 `pay:receivable-payable:settle`，与已有查询、重算权限分离。

## 设备订单确认收货

打印设备订单列表复用既有管理端接口 `GET /admin-api/order/store-order/take?id={orderId}`，不新增重复的收货接口。
设备订单聚合响应的 `orderInfo.id` 提供业务订单主键，`orderInfo.status` 表示业务订单状态，`paymentInfo.paid` 表示支付状态；当 `orderInfo.status=1` 且 `paymentInfo.paid=1` 时，管理端显示“确认收货”操作。接口继续走订单模块既有确认收货流程，由该流程生成应收应付，不直接执行分账。

## N/A

- DB 表结构：N/A。
- MQ/Redis Stream：N/A。
- 对外跨仓 API：N/A；仅 backend 内部 API 和 admin 管理端 API 增量。
