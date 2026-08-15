# 契约变更 — 订单计费模板与应收应付

## API 契约

### 管理后台：计费项

| Method & Path | 权限 | 语义 |
|---|---|---|
| `GET /admin-api/pay/billing-item/page` | `pay:billing-item:query` | 按名称、计费方式和状态分页查询本租户计费项。 |
| `GET /admin-api/pay/billing-item/get?id=` | `pay:billing-item:query` | 查询计费项详情。 |
| `POST /admin-api/pay/billing-item/create` | `pay:billing-item:create` | 新增计费项。 |
| `PUT /admin-api/pay/billing-item/update` | `pay:billing-item:update` | 编辑计费项；已被模板引用时不允许改变计费方式或属性名。 |
| `PUT /admin-api/pay/billing-item/update-status` | `pay:billing-item:update` | 启用/停用计费项。 |
| `DELETE /admin-api/pay/billing-item/delete?id=` | `pay:billing-item:delete` | 删除未被模板引用的计费项。 |
| `POST /admin-api/pay/billing-item/validate-order-attribute` | `pay:billing-item:query` | 校验指定字段是否存在于商户订单表且为可用金额类型。 |

`BillingItemSaveReqVO`：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `id` | Long | 更新是 | 本租户计费项。 |
| `itemName` | String | 是 | 1–64 字符，租户内唯一。 |
| `calculationType` | String | 是 | `ORDER_PERCENTAGE` / `ORDER_ATTRIBUTE`。 |
| `orderAttribute` | String | 条件 | `ORDER_ATTRIBUTE` 时必填，只允许字母、数字和下划线。 |
| `status` | Integer | 是 | `0=停用, 1=启用`。 |

`ValidateOrderAttributeReqVO`：`orderAttribute`。

`ValidateOrderAttributeRespVO`：`valid`, `columnName`, `dataType`, `message`。校验只返回元数据，不返回任何订单数据样本。

### 管理后台：计费模板

| Method & Path | 权限 | 语义 |
|---|---|---|
| `GET /admin-api/pay/billing-template/page` | `pay:billing-template:query` | 按名称、商圈、标签、默认标识和状态分页。 |
| `GET /admin-api/pay/billing-template/get?id=` | `pay:billing-template:query` | 返回模板头和有序明细。 |
| `POST /admin-api/pay/billing-template/create` | `pay:billing-template:create` | 原子创建模板和全部明细。 |
| `PUT /admin-api/pay/billing-template/update` | `pay:billing-template:update` | 原子替换模板头和明细。 |
| `PUT /admin-api/pay/billing-template/update-status` | `pay:billing-template:update` | 启用/停用；启用默认模板时校验租户唯一性。 |
| `DELETE /admin-api/pay/billing-template/delete?id=` | `pay:billing-template:delete` | 删除模板配置，不删除历史快照。 |

`BillingTemplateSaveReqVO`：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `id` | Long | 更新是 | 本租户模板。 |
| `templateName` | String | 是 | 1–64 字符，租户内唯一。 |
| `defaultTemplate` | Boolean | 是 | 启用的默认模板租户内唯一。 |
| `businessRegionId` | Long | 条件 | 非默认模板必填；必须属于本租户。 |
| `shopTagId` | Long | 否 | 必须属于本租户；默认模板必须为空。 |
| `priority` | Integer | 是 | 0–9999，数值越大优先级越高。 |
| `feeBearerMode` | String | 是 | `FIXED_RECIPIENT` / `CURRENT_MERCHANT`。 |
| `feeBearerRecipientId` | Long | 条件 | `FIXED_RECIPIENT` 时必填且收款人有效。 |
| `status` | Integer | 是 | `0=停用, 1=启用`。 |
| `lines` | Array | 是 | 至少一条，整单校验后原子保存。 |

`BillingTemplateLineReqVO`：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `billingItemId` | Long | 是 | 启用中的本租户计费项，模板内唯一。 |
| `baseType` | String | 条件 | 比例项必填：`BEFORE_COUPON` / `AFTER_COUPON`；属性项必须为空且请求不得传值。 |
| `percentage` | Decimal | 条件 | 比例项必填，0–100，最多 4 位小数；属性项必须为空且请求不得传值。 |
| `recipientMode` | String | 是 | `FIXED_RECIPIENT` / `CURRENT_MERCHANT`。 |
| `recipientId` | Long | 条件 | `FIXED_RECIPIENT` 时必填且为启用中的本租户收款人。 |
| `sort` | Integer | 是 | 0–9999；同值按明细 ID 升序。 |

### 管理后台：应收应付

| Method & Path | 权限 | 语义 |
|---|---|---|
| `GET /admin-api/pay/receivable-payable/page` | `pay:receivable-payable:query` | 按订单号、门店、商圈、计算状态和确认收货时间分页。 |
| `GET /admin-api/pay/receivable-payable/get?id=` | `pay:receivable-payable:query` | 返回主记录、计费明细、主体汇总及 AdaPay 衔接状态。 |
| `POST /admin-api/pay/receivable-payable/recalculate?id=` | `pay:receivable-payable:recalculate` | 仅对 `FAILED` 记录执行幂等重算。 |

`ReceivablePayableRespVO` 核心字段：

- 识别与范围：`id`, `orderId`, `shopId`, `shopName`, `businessRegionId`, `businessRegionName`。
- 计算快照：`templateId`, `templateNameSnapshot`, `beforeCouponAmount`, `discountAmount`, `afterCouponAmount`, `platformSubsidyAmount`, `allocatableAmount`。
- 状态：`calculationStatus`, `differenceFlag`, `errorCode`, `errorMessage`, `retryCount`, `calculatedAt`。
- 明细：`details[]`，包含计费项快照、基数/属性、比例、理论金额、实际金额、差异备注和排序。
- 主体汇总：`parties[]`，包含主体类型、收款人 ID/快照、实际金额、手续费承担标识和 AdaPay 可执行标识。

`calculationStatus`：

| 值 | 语义 | 可重算 | 可供分账 |
|---|---|---|---|
| `CALCULATING` | 计算中 | 否 | 否 |
| `SUCCESS` | 成功且无截断 | 否 | 是 |
| `SUCCESS_WITH_DIFFERENCE` | 成功但理论/实际存在差异 | 否 | 是 |
| `FAILED` | 配置或订单数据不可用 | 是 | 否 |

### 内部 API

| API | 调用方向 | 语义 |
|---|---|---|
| `BillingSettlementApi.calculate(String orderId)` | order-biz → pay-api | 订单确认收货后幂等生成应收应付；返回状态但不将业务失败抛回以回滚订单。 |
| `OrderBillingDataApi.getSnapshot(String orderId, Set<String> attributes)` | pay-biz → order-api | 返回订单金额、商圈/门店标识及指定受控属性值。 |
| `OrderBillingDataApi.validateAttribute(String attribute)` | pay-biz → order-api | 校验固定商户订单表的金额字段。 |
| `ProfitSharingOrderApi.createFromReceivablePayable(Long recordId)` | pay-biz 内部编排 | 将成功的主体汇总转为 AdaPay 待分账记录，幂等返回同一分账订单。 |

`OrderBillingSnapshotDTO`：`orderId`, `tenantId`, `shopId`, `businessRegionId`, `paid`, `payType`, `confirmTime`, `beforeCouponAmount`, `discountAmount`, `afterCouponAmount`, `platformSubsidyAmount`, `attributes`。

`BillingCalculationResultDTO`：`recordId`, `orderId`, `status`, `differenceFlag`, `errorCode`, `errorMessage`。

## 数据库契约

迁移脚本：`backend/sql/upgrade-2026-08-14-order-billing-template.sql`。新业务表均包含 `tenant_id`、审计字段和逻辑删除字段；金额使用 `decimal(12,2)`，比例使用 `decimal(7,4)`。

### `yshop_pay_billing_item`

计费项定义表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 计费项 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `item_name` | varchar(64) NOT NULL | 计费项名称，租户内唯一。 |
| `calculation_type` | varchar(32) NOT NULL | `ORDER_PERCENTAGE`=订单比例，`ORDER_ATTRIBUTE`=订单属性。 |
| `order_attribute` | varchar(64) NULL | 订单属性字段，仅订单属性类型填写。 |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=停用，1=启用。 |

### `yshop_pay_billing_template`

计费模板主表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 模板 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `template_name` | varchar(64) NOT NULL | 模板名称，租户内唯一。 |
| `is_default` | tinyint NOT NULL DEFAULT 0 | 是否为租户全局默认模板。 |
| `business_region_id` | bigint NULL | 商圈 ID；默认模板为空。 |
| `shop_tag_id` | bigint NULL | 可选门店标签 ID。 |
| `priority` | int NOT NULL DEFAULT 0 | 匹配优先级，数值越大越优先。 |
| `fee_bearer_mode` | varchar(32) NOT NULL | 手续费承担方类型：固定收款人或当前商家。 |
| `fee_bearer_recipient_id` | bigint NULL | 固定手续费承担收款人 ID。 |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=停用，1=启用。 |

每个租户最多有一个启用的全局默认模板。

### `yshop_pay_billing_template_line`

计费模板明细表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 模板明细 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `template_id` | bigint NOT NULL | 计费模板 ID。 |
| `billing_item_id` | bigint NOT NULL | 计费项 ID，同一模板内不可重复。 |
| `base_type` | varchar(32) NULL | 比例基数：`BEFORE_COUPON` / `AFTER_COUPON`。 |
| `percentage` | decimal(7,4) NULL | 计费比例，订单比例类型必填。 |
| `recipient_mode` | varchar(32) NOT NULL | 收款主体类型：固定收款人或当前商家。 |
| `recipient_id` | bigint NULL | 固定收款人 ID。 |
| `sorted` | int NOT NULL DEFAULT 0 | 金额分配顺序。 |

约束：服务端根据 `billingItemId` 对应计费项的 `calculation_type` 做条件校验。`ORDER_ATTRIBUTE` 明细不接受 `base_type` 或 `percentage`，计算时直接读取计费项绑定的订单属性金额；这两个字段在数据库中保持 `NULL`。

### `yshop_pay_receivable_payable_order`

订单应收应付计算主表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 应收应付记录 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `order_id` | varchar(32) NOT NULL | 订单号，同一租户内唯一。 |
| `shop_id` | bigint NOT NULL | 门店 ID。 |
| `business_region_id` | bigint NOT NULL | 商圈 ID。 |
| `template_id` | bigint NULL | 命中的模板 ID；匹配失败时为空。 |
| `template_name_snapshot` | varchar(64) NULL | 模板名称快照。 |
| `before_coupon_amount` | decimal(12,2) NULL | 券前金额快照。 |
| `discount_amount` | decimal(12,2) NULL | 优惠金额快照。 |
| `after_coupon_amount` | decimal(12,2) NULL | 券后即用户实付金额快照。 |
| `platform_subsidy_amount` | decimal(12,2) NULL | 平台补贴金额快照。 |
| `allocatable_amount` | decimal(12,2) NULL | 可计算金额。 |
| `calculation_status` | varchar(32) NOT NULL | 计算中、成功、成功但有差异或失败。 |
| `difference_flag` | tinyint NOT NULL DEFAULT 0 | 是否存在理论金额与实际金额差异。 |
| `error_code` | varchar(64) NULL | 失败错误码。 |
| `error_message` | varchar(512) NULL | 失败原因。 |
| `retry_count` | int NOT NULL DEFAULT 0 | 重算次数。 |
| `calculated_at` | datetime NULL | 计算完成时间。 |
| `confirm_time` | datetime NULL | 订单确认收货时间。 |

### `yshop_pay_receivable_payable_detail`

逐计费项计算明细表。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 计费明细 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `receivable_payable_order_id` | bigint NOT NULL | 应收应付主记录 ID。 |
| `template_line_id` | bigint NULL | 来源模板明细 ID。 |
| `billing_item_id` | bigint NULL | 来源计费项 ID；商家剩余行可为空。 |
| `item_name_snapshot` | varchar(64) NOT NULL | 计费项名称快照或“商家剩余”。 |
| `calculation_type` | varchar(32) NULL | 订单比例或订单属性。 |
| `base_type` | varchar(32) NULL | 券前或券后。 |
| `order_attribute_snapshot` | varchar(64) NULL | 订单属性字段快照。 |
| `base_amount` | decimal(12,2) NULL | 本项计算基数或属性值。 |
| `percentage` | decimal(7,4) NULL | 本项计费比例。 |
| `theoretical_amount` | decimal(12,2) NOT NULL | 按规则计算的理论金额。 |
| `actual_amount` | decimal(12,2) NOT NULL | 按可计算余额实际分配的金额。 |
| `recipient_mode` | varchar(32) NULL | 固定收款人或当前商家。 |
| `recipient_id` | bigint NULL | 解析后的收款人 ID。 |
| `recipient_name_snapshot` | varchar(128) NOT NULL | 收款主体名称快照。 |
| `sorted` | int NOT NULL | 分配顺序。 |
| `difference_reason` | varchar(256) NULL | 金额不足等差异备注。 |

### `yshop_pay_receivable_payable_party`

按收款主体汇总表，供后续分账使用。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint PK | 主体汇总 ID。 |
| `tenant_id` | bigint NOT NULL | 租户 ID。 |
| `receivable_payable_order_id` | bigint NOT NULL | 应收应付主记录 ID。 |
| `party_type` | varchar(32) NOT NULL | 固定收款人或当前商家。 |
| `party_key` | varchar(64) NOT NULL | 主记录内的主体汇总键。 |
| `recipient_id` | bigint NULL | 收款人 ID；商家未绑定时可为空。 |
| `recipient_name_snapshot` | varchar(128) NOT NULL | 收款主体名称快照。 |
| `amount` | decimal(12,2) NOT NULL | 主体应收、平台应付金额。 |
| `fee_bearer` | tinyint NOT NULL DEFAULT 0 | 是否承担支付通道手续费。 |
| `adapay_ready` | tinyint NOT NULL DEFAULT 0 | 是否具备 AdaPay 分账条件。 |

### 修改现有表

**`yshop_store_order`**

| 新增字段 | 类型 | 说明 |
|---|---|---|
| `platform_subsidy_amount` | decimal(12,2) NOT NULL DEFAULT 0.00 | 订单系统在下单时固化的平台补贴。 |

**`yshop_adapay_profit_sharing_order`**

| 新增字段/变更 | 类型 | 说明 |
|---|---|---|
| `receivable_payable_order_id` | bigint NULL | 关联通用应收应付记录，历史数据为空。 |
| `fee_bearer_recipient_id` | bigint NULL | 手续费承担收款人 ID。 |
| `calculation_type=3` | tinyint | 表示按通用计费模板计算。 |

**`yshop_adapay_profit_sharing_order_item`**

| 新增字段 | 类型 | 说明 |
|---|---|---|
| `receivable_payable_party_id` | bigint NULL | 关联通用主体汇总，历史数据为空。 |
| `subject_name_snapshot` | varchar(128) NULL | 动态收款主体名称快照。 |

### 复用与兼容

- 继续复用 `yshop_adapay_profit_recipient` 作为收款主体及 AdaPay 结算账户来源，新模板直接选择具体收款人。
- 新引擎启用后，平台级收款人允许多条启用记录，不再通过旧固定角色唯一推导收款人。
- `yshop_adapay_profit_sharing_rule` 不迁移、不删除，新引擎启用后不再读取。
- 历史 AdaPay 分账数据不回填新关联字段，原状态和金额语义保持不变。
- 已产生应收应付后仅允许关闭新引擎进行逻辑回滚，不执行破坏性删表。

## 权限与数据范围

| 菜单 | 权限 |
|---|---|
| 计费项管理 | `pay:billing-item:query/create/update/delete` |
| 计费模板管理 | `pay:billing-template:query/create/update/delete` |
| 应收应付管理 | `pay:receivable-payable:query/recalculate` |

- 所有配置、计算与收款人查询均按 `tenant_id` 隔离。
- 租户管理员/财务只能操作本租户。平台超管通过现有租户切换机制进入目标租户上下文，不在请求体中任意传入租户 ID。
- 商圈、门店标签、门店和收款人必须属于当前租户。
- 本期不对商家管理员或 C 端授权。

## 错误语义

| 符号 | 含义 |
|---|---|
| `BILLING_ITEM_NAME_EXISTS` | 计费项名称已存在。 |
| `BILLING_ITEM_IN_USE` | 计费项已被模板引用。 |
| `BILLING_ORDER_ATTRIBUTE_INVALID` | 字段不存在、不是金额类型或标识符不合法。 |
| `BILLING_TEMPLATE_DEFAULT_EXISTS` | 本租户已有启用的全局默认模板。 |
| `BILLING_TEMPLATE_ITEM_DUPLICATED` | 同一模板重复引用计费项。 |
| `BILLING_TEMPLATE_LINE_CONFIG_INVALID` | 计费项类型与模板明细参数不匹配；订单属性项不得设置券前/券后或比例。 |
| `BILLING_TEMPLATE_RECIPIENT_INVALID` | 固定收款人不存在、已停用或跨租户。 |
| `BILLING_TEMPLATE_NOT_MATCHED` | 未命中商圈模板且无有效全局默认模板。 |
| `BILLING_ORDER_AMOUNT_INVALID` | 订单金额缺失或可计算金额为负。 |
| `BILLING_ORDER_ATTRIBUTE_VALUE_INVALID` | 订单属性值缺失、非数值或为负。 |
| `BILLING_ALLOCATION_MISMATCH` | 主体汇总合计与可计算金额不等。 |
| `BILLING_RECORD_NOT_RECALCULABLE` | 记录不是失败状态或已被其他请求处理。 |
| `BILLING_ADAPAY_RECIPIENT_NOT_READY` | 通用计算成功，但存在未绑定/不可用的 AdaPay 收款人。 |

订单确认收货触发计费时，上述计费业务错误写入应收应付记录，不作为确认收货 API 失败返回。管理页面主动保存/重算时，仍按通用响应 `{ code, data, msg }` 返回可操作的业务错误。

## MQ、外部系统与依赖

- MQ：N/A，本期复用现有确认收货触发链路，不新增 topic 或消息格式。
- 外部系统：不新增；AdaPay 调用、重试和延迟分账契约沿用现有实现。
- 依赖：不新增第三方库。跨模块仅通过 `pay-api`、`order-api` 和 `store-api`。

## 兼容性

- 管理端新增 API，无 C 端 API 变更。
- `yshop_store_order.platform_subsidy_amount` 对存量订单默认为 0；存量订单不自动生成应收应付。
- AdaPay 历史分账数据的状态、金额和固定角色展示不变。
- 实现后更新 `governance/CONTRACT/backend-api.json`；本文档阶段不修改机器契约快照。
