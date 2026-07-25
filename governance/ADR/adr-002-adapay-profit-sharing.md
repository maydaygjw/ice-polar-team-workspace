# ADR-002: Adapay 延迟分账结算架构

## 状态

- 已批准

## 背景

当前系统支持微信支付、支付宝、Adapay 等多种支付方式。店铺收入通过 `RevenueJob` 日终结算，将资金从平台虚拟余额划转到店铺虚拟余额，店铺再通过提现功能将资金转出到银行卡/微信零钱。此模式下平台始终持有全部资金，存在合规风险，且店铺资金到账延迟（需等待店铺主动提现）。

Adapay 支付渠道支持三方支付的"延迟分账"模式：支付时设置 `pay_mode=delay` 冻结资金在平台账户，后续通过 `PaymentConfirm.create` 将资金按约定比例划转至多个收款人账户。这符合监管对"二清"（二次清算）的合规要求。

## 决策

采用 **Adapay 延迟分账 + 日终自动结算** 架构：

1. 支付时设置 `pay_mode=delay`，资金冻结在平台 Adapay 账户
2. 支付成功时创建分账挂起记录，固化分账金额
3. 日终 Job 遍历待分账订单，调用 Adapay `PaymentConfirm.create` 将资金划转至平台角色收款人和店铺绑定的收款人
4. 分账状态通过独立状态机管理，支持失败重试
5. 分账失败时自动回退到现有 `RevenueJob` 虚拟余额结算，保证店铺收入不丢失

## 方案对比

| 方案 | Pros | Cons |
|------|------|------|
| A: 实时分账（支付成功立即分账） | 资金即时到账，店铺体验好 | 分账失败时订单已支付，处理复杂；Adapay 实时分账对订单状态有要求 |
| B: 延迟分账 + 日终结算（选中） | 与现有日终结算模式一致；支付失败不分账，逻辑简单；可批量处理降低 API 调用成本；支持失败回退 | 店铺资金 T+1 到账 |
| C: 保持现有虚拟余额模式 | 无改动成本 | 不合规（二清风险）；资金池模式有监管风险；店铺提现需人工审核 |

## 影响

### 对现有代码的影响

- `AppStoreOrderServiceImpl.paySuccess()`：Adapay 支付成功时新增分账记录创建逻辑；缺少收款人时拒绝支付
- `RevenueJob`：现有虚拟余额结算 Job 保留（兼容非 Adapay 支付），新增 `ProfitSharingSettlementJob` 专门处理 Adapay 分账；分账失败时调用 RevenueJob 回退
- `StoreShopDO`：新增 `profit_sharing_recipient_id` 和 `profit_sharing_enabled` 字段
- 现有提现流程不受影响：分账模式下店铺资金直接到银行卡/支付宝，不再走虚拟余额提现

### 对 API/合约的影响

- 新增 `yshop-module-pay-api` 模块暴露 `ProfitSharingOrderApi` 和 `ProfitRecipientApi` 接口
- `order-biz` 通过 `pay-api` 调用分账服务，遵循现有 `-api` 模块规则
- 无 C-end API 变更，对小程序用户透明

### 对数据库的影响

- 新增 3 张表：`yshop_adapay_profit_recipient`、`yshop_adapay_profit_sharing_order`、`yshop_adapay_profit_sharing_log`
- 修改 `yshop_store_shop`：新增 2 个字段
- 所有新表含 `tenant_id`，遵循多租户隔离规则

### 对部署/运维的影响

- 日终 Job 执行时间建议设置在 00:05（避开 00:00 高峰期）
- 需监控分账失败率，配置告警
- 需关注 Adapay `member_id` 和结算账户绑定的合规要求

## 相关

- 替代的 ADR: 无
- 相关的合约: `CONTRACTS.md#Commission Contract`、`CONTRACTS.md#Module Dependency Rules`
- 相关的设计: `governance/feature-docs/2026-07-13-adapay-profit-sharing/technical-design.md`
