# ADR-004: Adapay 退款与支付撤销

## 状态

已接受

## 背景

`adapay-payment` 已完成 Adapay 支付创建、回调、`outPayNo` 映射与管理后台配置。随着业务上线，需要补充：

1. 对已支付 Adapay 订单发起退款。
2. 对未支付 Adapay 订单执行支付撤销（关闭 Adapay 侧支付单），避免用户取消/超时/重新支付后仍收到晚到的成功回调导致误履约。
3. 处理 Adapay 退款/关闭的异步通知。

约束与风险：

- Adapay 同一外部订单号不可重复发起支付，因此支付与退款/关闭都需通过 `outPayNo` 反查。
- 已接入 `adapay-profit-sharing` 延迟分账：分账确认后资金已拆分，此时原路退款需要先做分账回退，逻辑复杂且依赖 Adapay `profitSharingReverse`。
- 现有微信/支付宝退款为同步调用后即时更新订单状态，运营与用户体验已习惯该模式。

## 决策

1. **复用现有退款入口**：Adapay 退款/取消并退款复用 `POST /admin-api/order/store-order/refund` 与 `POST /admin-api/order/store-order/cancelAndRefund`，在 `StoreOrderServiceImpl.orderRefund(...)` 中新增 `ADAPAY` 分支。
2. **复用现有退款模型**：不新增退款记录表和退款状态枚举。Adapay 退款生成临时 `outRefundNo`（雪花 ID，与微信/支付宝退款单号生成方式一致）调用 Adapay 退款接口；`outRefundNo` 不持久化到独立表。退款结果与现有微信/支付宝一致，通过订单 `refund_status`（`OrderInfoEnum.REFUND_STATUS_*`）和订单日志表（`yshop_store_order_status`）表达。
3. **分账后暂不支持退款**：退款前查询 `profit_sharing_order`，仅 `PENDING/FAILED/FALLBACK` 状态允许退款；`SUCCESS/PROCESSING` 状态直接拒绝，等待后续需求支持分账回退后再放开。
4. **同步更新订单退款状态**：Adapay 退款接口返回受理成功/处理中时，立即更新订单 `refund_status = 2`、`status = -2`，与微信/支付宝现有逻辑一致；异步回调仅记录到订单日志表，不重复更新订单。
5. **未支付订单支付撤销**：用户主动取消、订单超时、重新支付前，调用 Adapay `close(...)` 关闭 Adapay 侧支付单，并将 `pay_out_order_no.status` 置为 `2`；关闭失败记录日志告警，不阻断本地取消流程。

## 方案对比

| 方案 | Pros | Cons |
|------|------|------|
| A: 独立退款单号 + 新表 `pay_refund_order` | 语义清晰，幂等可控，便于对账与审计 | 新增表与枚举，开发与维护成本高 |
| B: 复用现有退款模型（无新表/枚举） | 与微信/支付宝退款对齐，实现简单，维护成本低 | 退款单号不持久化，回调信息仅保存于订单日志；后续若需部分退款再考虑独立表 |
| C: 分账确认后仍允许退款 | 业务完整性好 | 需实现 `profitSharingReverse`、金额匹配、失败兜底，复杂度高，本次周期不可控 |
| D: 分账确认后禁止退款 | 实现简单，避免资金回退风险 | 已分账订单需人工或后续功能处理 |
| E: 等待异步回调成功才更新订单 | 状态更精确 | 与现有微信/支付宝退款不一致，运营体验变化大 |
| F: 同步返回成功/处理中即更新订单 | 与现有逻辑一致，体验统一 | 若异步通知失败，本地状态与实际 Adapay 状态短暂不一致，需靠回调记录订单日志修正 |

本次选择 **B + D + F**：复用现有退款模型、分账后暂不退款、同步更新订单。

## 影响

- **对现有代码的影响**：
  - `StoreOrderServiceImpl.orderRefund(...)` 增加 `ADAPAY` 分支。
  - `AdapayPayMessageHandler` 扩展 `CLOSED/REFUND_*` 处理。
  - 取消/超时/重新支付逻辑需调用 Adapay 关闭。
- **对 API/合约的影响**：
  - 复用现有退款/取消端点，无新增 admin 端点。
  - 回调端点复用 `/app-api/order/notify/payBackadapay_h5{tenantId}.json`。
  - 无新增枚举或数据库表；退款状态复用 `OrderInfoEnum.REFUND_STATUS_*`。
- **对数据库的影响**：
  - 退款/关闭不新增表；仅依赖已有的 `pay_out_order_no` 表及迁移脚本。
- **对部署/运维的影响**：
  - 退款/关闭回调需确保 Adapay 配置正确、验签通过。
  - 已分账订单退款被拒绝时，运营需知晓并等待后续分账回退功能。

## 相关

- 相关 ADR：`adr-003-adapay-out-pay-no.md`
- 相关合约：
  - `governance/feature-docs/adapay-payment/requirements-spec.md`
  - `governance/feature-docs/adapay-payment/technical-design.md`
  - `governance/feature-docs/adapay-payment/contract-changes.md`
- 依赖功能：`governance/feature-docs/adapay-profit-sharing/`（分账状态校验）
