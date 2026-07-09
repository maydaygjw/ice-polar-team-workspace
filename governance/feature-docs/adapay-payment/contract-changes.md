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

## DTO 变更

### 新增枚举值

| 枚举 | 新增值 | 用途 |
|------|--------|------|
| `PayTypeEnum` | `ADAPAY("adapay", "Adapay支付")` | 订单 `pay_type`、MQ `payType` |
| `PayIdEnum` | `ADAPAY_H5("adapay_h5", "Adapay支付H5")` | `merchant_details.details_id` 前缀 |

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

- **回滚方案**：删除 `pay_out_order_no` 表。

## 兼容性

- **向后兼容**：否。支付流程新增 `outPayNo` 持久化与反查步骤，需确保现有微信支付路径仍使用 `orderId` 作为 `outPayNo`。
- **前端同步变更**：是。管理后台支付配置表单与订单视图需增加 Adapay 选项。

## 错误码

| 错误码 | 含义 |
|--------|------|
| `ADAPAY_PAYMENT_QUERY_FAILED` | Adapay 支付单查询失败 |
| `ADAPAY_PAYMENT_STATUS_INVALID` | Adapay 支付单状态异常，请重新下单 |
| `OUT_PAY_NO_GENERATE_FAILED` | 外部支付单号生成失败 |
