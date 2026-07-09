# ADR-003: Adapay 外部支付单号（outPayNo）设计

## 背景

现有支付抽象将系统订单号 `orderId` 直接作为外部订单号传给第三方支付平台。微信支付允许同一订单号重复发起支付，因此不存在问题。

Adapay（汇付天下）不允许对同一个订单号重复发起支付。当用户支付失败或超时关闭后需要重新支付时，必须向 Adapay 提供一个全新的订单号。但系统内部订单号 `orderId` 是业务主键，不能随意变更。

## 决策

引入独立的 **外部支付单号（outPayNo）**，作为系统订单号与第三方支付平台订单号之间的映射层：

- **微信支付**：`outPayNo = orderId`，保持不变，与现有行为一致。
- **Adapay**：每次支付请求生成新的 `outPayNo`，格式为 `orderId-{递增序号}`。首次支付为 `orderId-1`，重新支付时取该订单下 Adapay 记录最大序号加 1。

新增 `pay_out_order_no` 表持久化 `outPayNo` 与 `orderId` 的映射关系，并在回调时通过 `outPayNo` 反查系统订单。

## 替代方案

| 方案 | 说明 | 未采纳原因 |
|------|------|-----------|
| 修改系统订单号 `orderId` | 重新支付时生成新的 `orderId` | 订单号是业务主键，关联订单商品、库存、售后、对账等多处，变更成本极高且容易破坏数据一致性。 |
| 仅在 Adapay 内部拼接随机后缀 | 不持久化映射 | 回调时无法可靠反查系统订单，幂等性与问题排查困难。 |

## 影响

- 所有支付请求在发起前需先确定或生成 `outPayNo`。
- Adapay 回调处理不再依赖回调参数中的系统订单号，而是通过 `outPayNo` 反查。
- MQ `order.pay.notice` 消息增加 `outPayNo` 字段，便于后续对账与问题追踪。
- 新增 `pay_out_order_no` 表，微信支付也会产生一条记录（`outPayNo = orderId`），保证模型统一。

## 状态

已接受。

## 相关

- `governance/feature-docs/adapay-payment/technical-design.md`
- `governance/feature-docs/adapay-payment/contract-changes.md`
