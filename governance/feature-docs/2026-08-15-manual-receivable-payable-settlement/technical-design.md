# 技术设计：手工触发应收应付结算

## 模块影响

| 模块 | 变更 |
|---|---|
| `yshop-module-order-biz` | 删除订单状态更新链路中的分账执行，仅保留确认收货后的通用计费。 |
| `yshop-module-pay-api` | 增加按应收应付记录发起结算的内部 API。 |
| `yshop-module-pay-biz` | 增加管理端手工结算接口，复用通用主体汇总到 AdaPay 的适配和幂等执行。 |
| `admin` | 应收应付列表增加状态展示和逐单“结算”按钮。 |

## 核心流程

```text
配送回调 -> updateOrderStatus(orderId, 2) -> 仅更新业务订单状态

用户确认收货 -> status=2 -> BillingSettlementApi.calculate(orderId)
                         -> 写入应收应付主表、明细和主体汇总

财务点击“结算” -> POST /pay/receivable-payable/settle?id={recordId}
                 -> 校验应收应付成功状态和 Adapay 支付
                 -> 创建/复用 AdaPay 分账订单
                 -> 执行 PaymentConfirm.create
```

## 关键决策

1. `OrderApiImpl.updateOrderStatus` 不再调用 `executeProfitSharingIfNeeded`；配送回调因此不会触发分账。
2. `AppStoreOrderServiceImpl.takeOrder` 保留 `billingSettlementApi.calculate(orderId)`，移除其后立即分账逻辑。
3. 手工结算按应收应付主记录 ID 操作，服务端通过当前租户查询订单和已支付 Adapay payment ID，禁止客户端传入租户 ID 或支付 ID。
4. `SUCCESS` 与 `SUCCESS_WITH_DIFFERENCE` 可结算；`FAILED` 不可结算，需先重算；非 Adapay 订单不执行 AdaPay。
5. 日终 Job 和手工按钮都调用同一个 `BillingSettlementApi.settle(recordId)`；已存在的分账记录复用现有状态机，已成功、处理中或已回退的记录不再次调用外部接口。

## 风险与控制

| 风险 | 控制 |
|---|---|
| 配送完成提前分账 | 删除订单状态更新链路中的执行调用，并覆盖回调路径测试。 |
| 重复点击造成重复分账 | 应收应付记录和现有分账订单均按租户/订单幂等校验。 |
| 跨租户访问结算记录 | 主记录、支付记录和分账记录均使用当前租户上下文查询。 |
| 收款人配置不完整 | 复用现有 `executeAdapay` 的主体与收款人校验，失败保留可重试状态。 |
