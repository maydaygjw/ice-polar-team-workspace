# 技术设计 — Adapay 第三方支付集成

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-api` | 修改 | 注册 Adapay 支付平台与回调处理器；扩展支付通知 MQ 消息 |
| `yshop-module-pay-biz` | 新增 | 新增 `outPayNo` 映射表及支付前记录逻辑 |
| `yshop-module-order-api` | 修改 | 扩展支付方式枚举；扩展 `paySuccess` 服务接口 |
| `yshop-module-order-biz` | 修改 | 增加 Adapay 支付分支与 `outPayNo` 生成/复用/回调处理链路 |
| `yshop-framework/yshop-common` | 修改 | 扩展支付 ID 枚举 |
| `admin/` | 修改 | 支付配置表单与订单视图增加 Adapay 选项 |
| `miniapp/` | 复用 | 无变更 |

## 架构决策

1. **复用现有支付抽象**：Adapay 作为新的第三方支付渠道，复用现有 `merchant_details` 配置表、`/app-api/order/pay` 入口、`/app-api/order/notify/payBack{detailsId}.json` 回调端点、以及 `order.pay.notice` Redis Stream 异步通知链路，不新增独立端点。
2. **配置方式与微信/支付宝一致**：管理后台“支付管理 > 支付配置”中新增 Adapay 选项，表单字段保持通用，不单独开发 Adapay 配置页面。
3. **支付方式枚举扩展**：新增 `adapay` 作为订单 `pay_type` 的合法值；新增 `adapay_h5{tenantId}` 作为 `merchant_details.details_id`，与现有 `ali_h5{tenantId}`、`wx_h5{tenantId}` 对齐。
4. **引入外部支付单号 outPayNo**：系统订单号 `orderId` 保持不变，但向第三方支付平台发起支付时使用独立的 `outPayNo`。
   - 微信支付：`outPayNo = orderId`，同一订单始终不变。
   - Adapay：每次重新支付生成新的 `outPayNo`（格式 `orderId-{递增序号}`），以满足 Adapay 不允许同一订单号重复发起的限制。
5. **outPayNo 持久化**：新增 `pay_out_order_no` 表记录每次支付请求使用的 `outPayNo`、对应 `orderId`、支付渠道、状态，用于回调反查订单与幂等控制。
6. **渠道锁定**：同一订单一旦通过某渠道发起支付，即锁定为该渠道，后续不允许切换为其他渠道。
7. **C 端不直接接入**：本次仅完成后端支付接口与回调链路，C 端支付页面选择 Adapay 由后续需求独立实现。

## 流程设计

### 支付流程

```
调用方 → POST /app-api/order/pay (paytype=adapay)
        → 生成/复用 outPayNo
        → 记录 pay_out_order_no
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
    └── 重新支付：取该 orderId 下 Adapay 记录最大序号 +1，生成 orderId + "-{n}"
```

### 支付单状态处理

```
创建支付单
    │
    ├─ 成功 → 记录 outPayNo → 返回支付参数
    │
    ├─ outPayNo 已存在且已支付 → 直接完成订单
    │
    ├─ outPayNo 已存在且支付中 → 复用支付参数
    │
    └─ 失败 → 返回错误
```

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Adapay SDK API 与状态值理解偏差 | 高 | 实现前确认 `AdapayPayMessage`、`AdapayStatus`、平台常量 |
| outPayNo 生成并发重复 | 中 | 使用数据库唯一索引（tenant_id + out_pay_no）兜底，冲突时重试取新序号 |
| 回调验签失败 | 中 | 复用 eGzosN 适配层验签，沙箱环境验证 |
| 渠道锁定与现有支付流程冲突 | 中 | 在支付入口统一判断订单已存在支付单时拒绝切换渠道 |
| 管理后台表单字段通用导致配置困惑 | 低 | MVP 接受，后续 deferred 动态字段展示 |

## 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/adapay-payment` |
| `admin/` | `feat/adapay-payment` |

## 契约层状态

| 层 | 状态 | 引用 |
|----|------|------|
| DB schema | 变更 | 新增 `pay_out_order_no` 表 → contract-changes.md |
| API | 复用 | 现有 `/app-api/order/pay`、回调端点、管理后台商户配置 API 接受新枚举值 → contract-changes.md |
| 事件/MQ | 变更 | `PayNoticeMessage` 扩展字段 → contract-changes.md |
| 依赖 | 变更 | 新增 Adapay SDK → contract-changes.md |
| 外部系统 | 变更 | 接入 Adapay 支付网关与回调 → contract-changes.md |
| ADR | 需要 | adr-003-adapay-out-pay-no.md |
