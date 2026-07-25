# 技术设计 — Adapay 第三方支付集成

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-api` | 修改 | 注册 Adapay 支付平台与回调处理器；扩展支付通知 MQ 消息；扩展回调处理器处理退款/关闭状态 |
| `yshop-module-pay-biz` | 新增 | 新增 `outPayNo` 映射表及支付前记录逻辑；提供 Adapay 关闭/退款底层调用封装 |
| `yshop-module-order-api` | 修改 | 扩展支付方式枚举；扩展 `paySuccess` 服务接口 |
| `yshop-module-order-biz` | 修改 | 增加 Adapay 支付分支与 `outPayNo` 生成、旧 attempt 关闭、回调处理链路；增加 Adapay 退款分支与分账状态校验；在取消/超时/重新支付时触发 Adapay 支付单关闭 |
| `yshop-framework/yshop-common` | 修改 | 扩展支付 ID 枚举 |
| `admin/` | 修改 | 支付配置表单与订单视图增加 Adapay 选项；订单退款/取消入口对 Adapay 订单生效 |
| `miniapp/` | 复用 | 无变更 |

## 架构决策

1. **复用现有支付抽象**：Adapay 作为新的第三方支付渠道，复用现有 `merchant_details` 配置表、`/app-api/order/pay` 入口、`/app-api/order/notify/payBack{detailsId}.json` 回调端点、以及 `order.pay.notice` Redis Stream 异步通知链路，不新增独立端点。
2. **配置方式与微信/支付宝一致**：管理后台“支付管理 > 支付配置”中新增 Adapay 选项，表单字段保持通用，不单独开发 Adapay 配置页面。
3. **支付方式枚举扩展**：新增 `adapay` 作为订单 `pay_type` 的合法值；新增 `adapay_h5{tenantId}` 作为 `merchant_details.details_id`，与现有 `ali_h5{tenantId}`、`wx_h5{tenantId}` 对齐。
4. **引入外部支付单号 outPayNo**：系统订单号 `orderId` 保持不变，但向第三方支付平台发起支付时使用独立的 `outPayNo`。
   - 微信支付：`outPayNo = orderId`，同一订单始终不变。
   - Adapay：待支付订单每次调用支付接口都生成新的 `outPayNo`（格式 `orderId-{递增序号}`），以满足 Adapay 不允许同一订单号重复发起的限制；不得复用上一条创建中的 Adapay `outPayNo`。
5. **outPayNo 持久化**：新增 `pay_out_order_no` 表记录每次支付请求使用的 `outPayNo`、对应 `orderId`、支付渠道、状态，用于回调反查订单与幂等控制。表保留历史 attempt，但同一订单同一支付渠道任一时刻只能有一条当前有效的待支付记录。
6. **渠道锁定**：同一订单一旦通过某渠道发起支付，即锁定为该渠道，后续不允许切换为其他渠道。
7. **C 端不直接接入**：本次仅完成后端支付接口与回调链路，C 端支付页面选择 Adapay 由后续需求独立实现。
8. **复用现有退款入口**：Adapay 退款/取消并退款复用 `POST /admin-api/order/store-order/refund` 与 `POST /admin-api/order/store-order/cancelAndRefund`，在 `StoreOrderServiceImpl.orderRefund(...)` 中新增 `ADAPAY` 分支，保持与微信/支付宝退款体验一致。
9. **复用现有退款模型**：不新增退款记录表和退款状态枚举。Adapay 退款生成临时 `outRefundNo`（雪花 ID，与微信/支付宝退款单号生成方式一致）调用 Adapay 退款接口；`outRefundNo` 不持久化到独立表。退款结果与现有微信/支付宝一致，通过订单 `refund_status`（`OrderInfoEnum.REFUND_STATUS_*`）和订单日志表（`yshop_store_order_status`）表达。
10. **分账后暂不支持退款**：退款前查询 `profit_sharing_order`，仅 `PENDING/FAILED/FALLBACK` 状态允许退款；`SUCCESS/PROCESSING` 状态直接拒绝，避免 Adapay 侧分账已确认导致退款失败。
11. **同步更新订单退款状态**：Adapay 退款接口返回受理成功/处理中时，立即更新订单 `refund_status = 2`、`status = -2`，与微信/支付宝现有逻辑一致；异步回调仅记录到订单日志表，不重复更新订单。
12. **支付撤销仅用于退款场景**：用户主动取消、订单超时未支付时，仅更新本地订单状态，不调用 Adapay 关闭/撤销接口；支付撤销仅在管理员同意退款或直接退款时调用，用于关闭 Adapay 侧支付单并原路退回资金。重新支付前由支付入口将本地旧 `pay_out_order_no` 记录置为 `status = 2`，并生成新的 `outPayNo` 向 Adapay 发起新支付单，无需调用 Adapay 关闭旧单。

## 流程设计

### 支付流程

```
调用方 → POST /app-api/order/pay (paytype=adapay)
        → 关闭该 orderId 下上一条 Adapay 创建中记录（如存在）
        → 生成新的 outPayNo
        → 记录新的 pay_out_order_no 当前有效记录
        → 使用 outPayNo 创建 Adapay 支付单
        → 返回支付参数
        → 用户完成 Adapay 付款
        → Adapay 回调 /app-api/order/notify/payBackadapay_h5{tenantId}.json (携带 outPayNo)
        → 回调处理器通过 outPayNo 反查 orderId
        → 校验成功 → 发送 order.pay.notice (含 orderId, payType, adapayPaymentId)
        → PayNoticeConsumer 更新订单为已支付
```

### outPayNo 生成规则

```
微信支付
    └── outPayNo = orderId（永远不变）

Adapay 支付
    └── 首次支付：outPayNo = orderId + "-1"
    └── 重新支付：先关闭上一条当前有效待支付记录，再取该 orderId 下 Adapay 历史记录最大序号 +1，生成 orderId + "-{n}"
    └── 约束：同一 orderId + payType 任一时刻只有一条 status=0 的当前有效记录
```

### 支付单状态处理

```
创建支付单
    │
    ├─ 成功 → 记录 outPayNo → 返回支付参数
    │
    ├─ outPayNo 已存在且已支付 → 直接完成订单
    │
    ├─ Adapay 同订单已有支付中 attempt → 关闭旧 attempt，生成新的 outPayNo 后重新向 Adapay 创建支付单
    │
    └─ 失败 → 返回错误
```

### pay_out_order_no 有效性规则

- `status = 0` 表示当前有效待支付 attempt；`status = 1` 表示支付成功；`status = 2` 表示关闭或被新 attempt 取代。
- Adapay 每次新建 attempt 前，应将同一 `tenant_id + order_id + pay_type` 下现有 `status = 0` 记录置为 `status = 2`，再插入新的 `status = 0` 记录。
- 历史记录不删除，用于回调反查、审计和对账。
- 旧 attempt 的成功回调仍可能发生；回调处理必须以订单已支付状态为最终幂等边界，避免重复履约。
- 若数据库无法直接表达“仅一条 status=0”的部分唯一约束，必须在服务层事务内关闭旧记录并创建新记录，同时保留唯一索引 `tenant_id + out_pay_no` 兜底。

### 退款流程

```
管理后台 → POST /admin-api/order/store-order/refund 或 /cancelAndRefund
         → 校验订单 pay_type = adapay、已支付、未分账确认
         → 查询该 orderId 下已支付的 outPayNo 与 adapayPaymentId
         → 生成 outRefundNo（雪花 ID，与微信/支付宝一致，不持久化）
         → 调用 Adapay refund(outRefundNo, adapayPaymentId, outPayNo, refundAmount, totalAmount)
         → Adapay 返回 SUCCESS/PROCESSING
         → 更新订单 refund_status = 2、status = -2
         → 回退库存、优惠券、门店收支、佣金
         → 记录订单日志（yshop_store_order_status）：refund_price_success
         → Adapay 异步回调 REFUND_SUCCESS/REFUND_FAILED
         → 记录订单日志：退款回调结果；订单已退款时幂等
```

### 支付撤销/关闭流程

```
用户取消未支付订单 或 订单超时
         → 仅本地更新订单状态及退款状态，回退库存、优惠券等
         → 不调用 Adapay close

管理员同意退款/直接退款
         → 查询该 orderId 下 pay_type = adapay 且 status = 1 的 outPayNo 与 adapayPaymentId
         → 生成 outRefundNo
         → 调用 Adapay refund(outRefundNo, adapayPaymentId, outPayNo, refundAmount, totalAmount)
         → 同步返回成功/处理中时，更新订单为已退款并回滚业务

重新支付前
         → 由支付入口将本地旧 `pay_out_order_no` 记录置为 `status = 2`
         → 生成新的 outPayNo 后创建 Adapay 支付单
         → 无需调用 Adapay 关闭旧单
```

### 退款/关闭回调处理流程

```
Adapay 回调 /app-api/order/notify/payBackadapay_h5{tenantId}.json
         → 验签
         → 按状态分发：
           ├─ PAY_SUCCESS   → 反查 orderId → 发送 order.pay.notice → 更新 pay_out_order_no.status = 1
           ├─ CLOSED        → 更新 pay_out_order_no.status = 2
           ├─ REFUND_PROCESSING → 记录订单日志：退款处理中
           ├─ REFUND_SUCCESS    → 记录订单日志：退款成功；订单已退款时幂等
           └─ REFUND_FAILED     → 记录订单日志：退款失败及错误信息
         → 返回 SUCCESS
```

### 退款单号与幂等

```
Adapay 退款
    └── outRefundNo = IdUtil.getSnowflake(0, 0).nextIdStr()（与微信/支付宝退款单号一致）
    └── outRefundNo 仅作为调用 Adapay 的 refundNo，不持久化到独立退款表
    └── 同一 outPayNo 只能有一条成功退款；通过订单 refund_status = 2 与订单日志兜底幂等
```

- 不新增退款记录表，退款结果通过 `OrderInfoEnum.REFUND_STATUS_*` 和 `yshop_store_order_status` 表达。
- 退款前校验订单 `refund_status`，已退款订单直接幂等返回。
- 同一 `outPayNo` 累计退款金额不得超过原支付金额；本次仅支持全额退款，即一笔成功退款后该 `outPayNo` 不可再次退款。
- 退款失败记录到订单日志表，允许管理后台重新发起退款。

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Adapay SDK API 与状态值理解偏差 | 高 | 实现前确认 `AdapayPayMessage`、`AdapayStatus`、平台常量 |
| outPayNo 生成并发重复 | 中 | 使用数据库唯一索引（tenant_id + out_pay_no）兜底，冲突时重试取新序号 |
| 同一订单存在多条有效待支付记录 | 中 | 新建 Adapay attempt 前关闭旧 `status=0` 记录；服务层事务保证任一时刻只有一条当前有效记录 |
| 旧支付 attempt 回调晚到 | 中 | 回调通过 `outPayNo` 反查，订单已支付后幂等返回，禁止重复履约 |
| 回调验签失败 | 中 | 复用 eGzosN 适配层验签，沙箱环境验证 |
| 渠道锁定与现有支付流程冲突 | 中 | 在支付入口统一判断订单已存在支付单时拒绝切换渠道 |
| 管理后台表单字段通用导致配置困惑 | 低 | MVP 接受，后续 deferred 动态字段展示 |
| 分账状态校验遗漏导致退款失败 | 高 | 退款前强制查询 `profit_sharing_order`，`SUCCESS/PROCESSING` 状态直接拒绝 |
| Adapay 退款/关闭状态理解偏差 | 高 | 实现前确认 `AdapayRefundResult`、`AdapayStatus` 各状态语义 |
| 退款回调幂等处理不当 | 中 | 以订单 `refund_status = 2` 为幂等边界，重复回调仅记录订单日志，不重复更新订单或回滚业务 |
| 关闭调用失败导致 Adapay 侧脏单 | 中 | 用户取消与重新支付场景不调用 Adapay 关闭；退款时调用关闭失败记录告警日志 |
| 同一 outPayNo 重复退款 | 中 | 退款前校验订单 `refund_status`，已退款订单直接幂等返回 |

## 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/adapay-payment` |
| `admin/` | `feat/adapay-payment` |

## 契约层状态

| 层 | 状态 | 引用 |
|----|------|------|
| DB schema | 变更 | 新增 `pay_out_order_no` 表 → contract-changes.md |
| API | 复用 | 现有 `/app-api/order/pay`、回调端点、管理后台商户配置 API 与退款 API 接受新枚举值 → contract-changes.md |
| 事件/MQ | 变更 | `PayNoticeMessage` 扩展字段；退款/关闭回调复用现有回调端点 → contract-changes.md |
| 依赖 | 变更 | 新增 Adapay SDK → contract-changes.md |
| 外部系统 | 变更 | 接入 Adapay 支付网关、退款、关闭与回调 → contract-changes.md |
| ADR | 需要 | adr-003-adapay-out-pay-no.md、adr-004-adapay-refund-and-close.md |
