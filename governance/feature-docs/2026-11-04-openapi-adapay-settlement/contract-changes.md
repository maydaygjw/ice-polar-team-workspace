# OpenAPI AdaPay 结算与对账契约变更

## API

### OpenAPI 支付创建

`POST /open-api/v1/payments` 请求新增：

| 字段 | 类型 | 规则 |
|---|---|---|
| `businessRegionCode` | string | 必填；在 token 租户下唯一，且对应启用商圈。服务端解析该商圈的 OpenAPI 默认店铺。 |

原有 `amount` 继续以人民币分的正整数传入；AdaPay 的整个金额作为计费基数，无优惠和平台补贴。客户端不得提交 `shopId`、模板 ID、收款人或分账比例。相同 `clientOrderNo` 的请求摘要纳入商圈代码，内容变化返回原有冲突语义。

### 主动结算

| 方法与路径 | Scope | 语义 |
|---|---|---|
| `POST /open-api/v1/payments/by-client-order/{clientOrderNo}/settle` | `payment` | 仅当前租户、当前 OAuth client 创建的 AdaPay 支付单可调用；按支付单快照幂等补生成缺失的应收应付，并执行现有分账。 |

请求体为空。响应返回平台支付单号、clientOrderNo、结算状态及可诊断结果。未支付、退款处理中/成功、微信渠道或无有效应收应付时不得调用 AdaPay 分账；已成功结算的重复请求返回已有结算状态。

### 结算与退款错误

- `404`：clientOrderNo 不存在或不属于当前 OAuth client；不泄漏其他客户端记录。
- `409`：支付尚未成功、退款处理中/成功、分账处理中/成功，或支付渠道不支持分账。
- `400`：商圈、默认店铺、金额或计费模板不满足创建条件。
- 错误体继续使用平台 `CommonResult` 稳定错误码格式。
- OpenAPI AdaPay 全额退款若已有 PROCESSING/SUCCESS 分账必须拒绝；退款处理中时主动及自动结算都应拒绝。退款成功会将未结算应收应付标为 `CANCELLED`；退款失败后可再次结算。

## 管理端商圈接口

商圈新增、修改、详情、列表响应增加 `openApiDefaultShopId`，并返回/展示对应的店铺名称（如现有 VO 可通过 ID 回显则最少提供 ID 和选项列表）。创建或更新时服务端校验店铺存在、未停用、租户一致且 `businessRegionId` 等于当前商圈。

`BusinessRegionQueryApi.getEnabledRegionByCode` 返回 `openApiDefaultShopId`，供 Pay 模块通过内部 `-api` 调用；不得从支付请求接受店铺 ID。

## Database

- `business_region.open_api_default_shop_id BIGINT NULL`：每商圈配置一个 OpenAPI 默认店铺；仅引用同租户且同商圈的启用店铺。
- `pay_open_api_order` 新增 `business_region_id`、`business_region_code`、`shop_id`、`shop_name_snapshot`、`billing_snapshot` 字段，保存支付创建时的计算上下文快照。
- 迁移脚本位于 `backend/sql/migrations/`，只加 nullable 字段和必要索引；不为既有商圈/支付单猜测或回填店铺。
- 现有 receivable/payable、profit sharing、reconciliation 表复用，不为 OpenAPI 单独复制同类账务表。

## MQ / Scheduled Jobs

- 支付成功通知消费者在现有 OpenAPI 状态更新流程中幂等生成应收应付事实；支付通知重复投递不可重复生成。
- 既有 00:05 AdaPay 分账任务扩展查询 OpenAPI AdaPay 待结算事实；结算成功/处理中记录不得重复执行。
- 既有 02:00 AdaPay 对账任务的 PAYMENT 本地数据增加 OpenAPI AdaPay 成功支付；PROFIT_SHARING 继续复用现有本地分账表及对账键。
- 微信账单对账、AdaPay 退款账单/RefundDiv 不扩展。

## 权限与隔离

- 支付创建、查询、退款和主动结算沿用 `payment` scope；本期不新增 `settlement` scope。
- OpenAPI 所有读写以 token 租户 + clientId 过滤。后台商圈店铺配置沿用现有商圈管理权限和租户/部门数据权限。
- 退款与分账用同一 paymentId 互斥，保证同一 AdaPay 支付不会同时发起全额退款与 PaymentConfirm。
