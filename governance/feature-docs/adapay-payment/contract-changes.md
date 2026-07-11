# 契约变更 — Adapay 第三方支付集成

## 端点变更

### App 端点 — 复用

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `POST /app-api/order/pay` | 复用 | 接受 `paytype: "adapay"` |
| `POST /app-api/order/notify/payBack{detailsId}.json` | 复用 | Adapay 回调路径：`payBackadapay_h5{tenantId}.json` |

### Admin 端点 — 复用

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `POST /admin-api/pay/merchant-details/create` | 复用 | `payType` 可传入 Adapay 平台名 |
| `PUT /admin-api/pay/merchant-details/update` | 复用 | 同上 |
| `GET /admin-api/pay/merchant-details/page` | 复用 | 可按 Adapay 平台名筛选 |
| `DELETE /admin-api/pay/merchant-details/delete` | 复用 | 删除 Adapay 配置 |

### 退款/支付撤销端点 — 复用

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `POST /admin-api/order/store-order/refund` | 复用 | 同意 Adapay 订单退款；校验分账状态为 `PENDING/FAILED/FALLBACK`，生成雪花 ID 作为 `outRefundNo` 同步调用 Adapay 退款 |
| `POST /admin-api/order/store-order/cancelAndRefund` | 复用 | 取消 Adapay 订单并全额退款；复用 `refund` 退款链路 |
| `POST /app-api/order/cancel` | 复用 | 用户取消未支付 Adapay 订单时，仅本地更新状态，不调用 Adapay |
| `POST /app-api/site/order/cancel/{orderId}` | 复用 | 站点订单取消未支付 Adapay 订单时，仅本地更新状态，不调用 Adapay |
| `POST /app-api/order/notify/payBack{detailsId}.json` | 复用 | Adapay 退款/关闭异步回调：`payBackadapay_h5{tenantId}.json` |

## DTO 变更

### 新增枚举值

| 枚举 | 新增值 | 用途 |
|------|--------|------|
| `PayTypeEnum` | `ADAPAY("adapay", "Adapay支付")` | 订单 `pay_type`、MQ `payType` |
| `PayIdEnum` | `ADAPAY_H5("adapay_h5", "Adapay支付H5")` | `merchant_details.details_id` 前缀 |

### 回调消息扩展

Adapay 回调报文状态复用 `AdapayStatus` 已有值：`PAY_SUCCESS`、`CLOSED`、`REFUND_PROCESSING`、`REFUND_SUCCESS`、`REFUND_FAILED`。

`AdapayPayMessageHandler` 按状态分发：

| 状态 | 处理 |
|------|------|
| `PAY_SUCCESS` | 反查 `orderId`，发送 `order.pay.notice`，更新 `pay_out_order_no.status = 1` |
| `CLOSED` | 更新 `pay_out_order_no.status = 2` |
| `REFUND_PROCESSING` | 记录订单日志：`yshop_store_order_status` 记退款处理中 |
| `REFUND_SUCCESS` | 记录订单日志：退款成功；订单已退款时幂等 |
| `REFUND_FAILED` | 记录订单日志：退款失败及错误信息 |

### MQ 消息扩展

| Topic | 字段 | 类型 | 必填 | 说明 |
|-------|------|------|------|------|
| `order.pay.notice` | `orderId` | String | 是 | 系统订单编号 |
| `order.pay.notice` | `payType` | String | 否 | 支付方式，`adapay` 时为 Adapay |
| `order.pay.notice` | `adapayPaymentId` | String | 否 | Adapay 支付对象 ID，仅 Adapay 支付时非空，供分账使用 |
| `order.pay.notice` | `outPayNo` | String | 否 | 外部支付单号；Adapay 重新支付时会变化 |

### 内部服务接口扩展

| 接口 | 变更 |
|------|------|
| `AppStoreOrderService.paySuccess(String, String)` | 保留为 default 方法，委托到 4 参数版本 |
| `AppStoreOrderService.paySuccess(String, String, String, String)` | 新增，第三参数为 Adapay `payment_id`，第四参数为 `outPayNo`，其他渠道传 `null` |

## 事件/MQ

| Topic | Payload | 生产者 | 消费者 | 顺序要求 |
|-------|---------|--------|--------|----------|
| `order.pay.notice` | `PayNoticeMessage { orderId, payType, adapayPaymentId, outPayNo }` | Adapay 回调处理器 | `PayNoticeConsumer` | 无强顺序要求，依赖订单状态幂等 |

## 依赖变更

| 依赖 | 变更 | 版本 |
|------|------|------|
| `com.holuntech:pay-java-adapay` | 新增 | `2.14.14-SNAPSHOT` |

## 数据库变更

- **迁移脚本**：`sql/upgrade-2026-07-09-adapay-out-pay-no.sql`
- **新增表**：`pay_out_order_no`

| 字段 | 类型 | 可空 | 说明 |
|------|------|------|------|
| `id` | BIGINT | 否 | 主键 |
| `tenant_id` | BIGINT | 否 | 租户 ID |
| `order_id` | VARCHAR(64) | 否 | 系统订单号 |
| `out_pay_no` | VARCHAR(128) | 否 | 外部支付单号，传给第三方支付平台 |
| `pay_type` | VARCHAR(32) | 否 | 支付渠道，如 `adapay`、`weixin` |
| `status` | TINYINT | 否 | 0 创建，1 成功，2 关闭 |
| `deleted` | TINYINT | 否 | 逻辑删除 |
| `create_time` | DATETIME | 否 | 创建时间 |
| `update_time` | DATETIME | 否 | 更新时间 |

- **索引**：
  - 唯一索引 `uk_tenant_out_pay_no` (`tenant_id`, `out_pay_no`)
  - 普通索引 `idx_tenant_order_id` (`tenant_id`, `order_id`)
  - 普通索引 `idx_tenant_pay_type_order_id` (`tenant_id`, `pay_type`, `order_id`)

- **业务约束**：
  - `pay_out_order_no` 保留每次支付 attempt 的历史记录。
  - Adapay 同一 `tenant_id + order_id + pay_type` 任一时刻只能有一条当前有效待支付记录（`status = 0`）。
  - Adapay 待支付订单每次调用 `POST /app-api/order/pay` 都必须将本地旧 `pay_out_order_no` 记录置为 `status = 2`，并创建新的 `out_pay_no = orderId-{n}`，不得复用旧 `out_pay_no` 再次请求 Adapay；无需调用 Adapay 关闭旧支付单。
  - 成功回调以 `out_pay_no` 反查订单；重复或乱序回调必须以订单已支付状态保证幂等，不得重复履约。
  - MySQL 普通唯一索引不能直接表达 `status = 0` 的部分唯一约束时，由服务层事务保证“一条当前有效记录”，`uk_tenant_out_pay_no` 仅兜底外部单号不重复。

- **回滚方案**：删除 `pay_out_order_no` 表。

## 兼容性

- **向后兼容**：否。支付流程新增 `outPayNo` 持久化与反查步骤；退款流程在 `StoreOrderServiceImpl.orderRefund(...)` 中新增 `ADAPAY` 分支并增加分账状态校验。需确保现有微信支付路径仍使用 `orderId` 作为 `outPayNo`。
- **前端同步变更**：是。管理后台支付配置表单与订单视图需增加 Adapay 选项；订单退款/取消入口对 Adapay 订单生效，无需新增独立页面。

## 错误码

| 错误码 | 含义 |
|--------|------|
| `ADAPAY_PAYMENT_QUERY_FAILED` | Adapay 支付单查询失败 |
| `ADAPAY_PAYMENT_STATUS_INVALID` | Adapay 支付单状态异常，请重新下单 |
| `OUT_PAY_NO_GENERATE_FAILED` | 外部支付单号生成失败 |
| `ADAPAY_REFUND_FAILED` | Adapay 退款调用失败 |
| `ADAPAY_CLOSE_FAILED` | Adapay 支付单关闭失败 |
| `ADAPAY_REFUND_CALLBACK_INVALID` | Adapay 退款回调单号或状态非法 |
| `ADAPAY_REFUND_NOT_ALLOWED_AFTER_SHARING` | 该订单已分账确认，暂不支持退款 |
| `REFUND_AMOUNT_EXCEEDED` | 累计退款金额超过支付金额 |
| `ORDER_REFUND_NOT_ADAPAY` | 该订单非 Adapay 支付，无法使用 Adapay 退款通道 |
