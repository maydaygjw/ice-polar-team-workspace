# 技术设计 — Adapay 分账结算

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-biz` | 修改 | 新增分账收款人 CRUD、分账订单 Service、Adapay 分账 SDK 封装（Member/结算账户创建、`Payment.create` delay、`PaymentConfirm.create`）、日终结算 Job、分账失败回退 |
| `yshop-module-pay-api` | 修改 | 新增分账 DTO、Service 接口、ErrorCode |
| `yshop-module-store-biz` | 修改 | 店铺绑定/解绑分账收款人；查询时返回分账启用状态 |
| `yshop-module-store-api` | 修改 | 新增店铺绑定分账收款人 DTO |
| `yshop-module-order-biz` | 修改 | `paySuccess()` 中 Adapay 支付且店铺启用分账时，调用 pay-api 创建分账挂起记录；校验收款人配置 |
| `yshop-module-mall` (sql) | 修改 | 新增迁移脚本 |

### 跨模块依赖

```
yshop-module-order-biz ──→ yshop-module-pay-api (ProfitSharingOrderApi)
yshop-module-store-biz ──→ yshop-module-pay-api (ProfitRecipientApi)
```

## 架构决策

1. **延迟分账**：支付时 `pay_mode=delay`，资金冻结在平台账户，日终统一执行分账确认。避免实时分账带来的并发和部分退款复杂性。
2. **分账金额固化**：`yshop_adapay_profit_sharing_order` 创建时即计算并固化 `commission_amount`、`shop_amount`，不受后续 `commission_rate` 变更影响。
3. **MemberId 编码**：`member_id` 不依赖 Adapay 返回值，按本地规则 `m_{租户Id}_{memberType}_{IdCard}_{storeId|0 for 平台}` 生成。天然保证同店铺同身份证号不可重复创建收款人。
4. **平台级收款人角色唯一**：同租户同角色只有一个启用中的平台级收款人。通过业务层校验实现（创建时将同角色其他记录置为 `status=0`），不用数据库唯一索引。
5. **店铺级收款人无角色**：店铺级收款人默认归属于指定店铺，无需分账角色。店铺只能选择绑定该店铺的收款人。
6. **结算账户可修改**：编辑收款人时允许修改结算账户（银行卡），后台同步调用 Adapay 更新绑定。
7. **分账失败兜底**：Adapay 分账失败后，自动回退到现有 `RevenueJob` 虚拟余额结算，标记 `fallback_revenue=1`，保证店铺收入不丢失。
8. **支付前置校验**：店铺启用分账但缺少有效平台/店铺收款人时，拒绝支付。失败在支付前暴露，不等到日终才报错。
9. **Member 与结算账户同步创建**：创建收款人时串行调用 Adapay 创建 Member → 绑定结算账户，任一步失败直接抛错不入库，避免后续分账因缺少结算账户失败。
10. **Job 幂等**：通过 `sharing_status` 状态机保证，同一订单不会重复分账。
11. **分账前金额校验**：执行分账前校验 `platform_amount + shop_amount == pay_price`，不一致时标记失败不分账。

> 无新架构范式，复用现有模块分层、多租户拦截器、Job 调度模式。不新增 ADR。

## 流程设计

### 分账订单状态机

```
0 (待分账) ──→ 1 (分账中) ──→ 2 (分账成功)
                   │
                   └──→ 3 (分账失败) ──→ 4 (已回退)
                                        │
                                        └──→ 手动重试 → 1
```

- `0→1`: Job 开始执行分账
- `1→2`: Adapay 返回成功
- `1→3`: Adapay 返回失败
- `3→4`: 自动回退到 RevenueJob 后标记
- `3→1`: 管理后台手动重试（仅 `fallback_revenue=0` 时）

### 核心链路

**支付时挂起**：用户支付 → Adapay 回调 → `paySuccess()` → 校验收款人 → 计算抽成 → 调用 `ProfitSharingOrderApi.createSharingOrder()` 写入待分账记录（`status=0`）

**日终结算**：Quartz 每日 00:05 → 多租户遍历 → 查询 `status=0` 且订单可结算的记录 → 分页（每批 100）→ 调用 `PaymentConfirm.create` → 更新 `status=2` 或 `3`

**失败回退**：`status=3` → 写入 `RevenueJob` 店铺收入（type=1）和平台抽成（type=3）→ 标记 `fallback_revenue=1`

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Adapay 分账 API 调用失败 | 高 | 自动回退 RevenueJob + 后台手动重试 |
| 分账金额计算错误 | 高 | 创建时固化 + 执行前校验 `platform + shop == payPrice` |
| 店铺未绑定收款人 | 中 | 支付时前置校验，明确错误提示 |
| 退款订单已分账 | 中 | 本期 deferred；后续通过 `PaymentConfirmReverse` 实现 |
| 日终 Job 超时 | 低 | 分页处理，每批 100；支持幂等重跑 |
| 企业 Member 附件存储 | 低 | 复用现有文件存储接口 |

## 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/adapay-profit-sharing` |
| `admin/` | `feat/adapay-profit-sharing` |

> `miniapp/` 无变更，C 端用户无感知。

## 契约层状态

| 层 | 状态 | 引用 |
|----|------|------|
| DB schema | 变更 | → contract-changes.md §数据库变更 |
| API | 新增 | → contract-changes.md §端点变更 |
| 事件/MQ | N/A | 无新增事件 |
| 依赖 | 复用 | Adapay SDK 已在依赖登记册中 |
| ADR | 不需要 | 复用现有模块分层、多租户、Job 模式，无新架构范式 |
