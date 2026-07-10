# 契约变更 — Adapay 分账结算

## 端点变更

### 银行列表

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `GET /admin-api/pay/bank/list` | 新增 | 查询启用中的银行列表。无 `keyword` 时返回主要银行（`is_primary=1`）；传入 `keyword` 时按银行名称/编码模糊搜索全部启用银行。返回 `{ bankCode, bankName, isPrimary }[]` |

### 省市级联列表

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `GET /admin-api/pay/adapay-region/province-list` | 新增 | 查询 Adapay 启用中的省份列表。返回 `{ regionCode, regionName }[]`，按 `region_code` 升序 |
| `GET /admin-api/pay/adapay-region/city-list` | 新增 | 根据 Adapay 省份编码查询启用中的城市列表。参数 `provinceCode` 必填。返回 `{ regionCode, regionName }[]`，按 `region_code` 升序 |

**权限**: `pay:adapay-region:query`（或复用 `pay:profit-recipient:query`）

**权限**: `pay:bank:query`（复用 `pay:profit-recipient:query` 亦可，由 backend agent 按现有权限段分配）

### 分账收款人管理

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `POST /admin-api/pay/profit-recipient/create` | 新增 | 创建收款人。后台按 `m_{租户Id}_{memberType}_{IdCard}_{storeId|0}` 生成 `member_id`，同步调用 Adapay 创建 Member 并绑定结算账户 |
| `PUT /admin-api/pay/profit-recipient/update` | 新增 | 更新收款人基础信息；`settleAccount` 可选，仅在更换结算账户时传入，传入后同步调用 Adapay 更新绑定 |
| `DELETE /admin-api/pay/profit-recipient/delete` | 新增 | 删除收款人（已绑定店铺时拒绝） |
| `GET /admin-api/pay/profit-recipient/get` | 新增 | 收款人详情 |
| `GET /admin-api/pay/profit-recipient/page` | 新增 | 收款人分页列表 |
| `GET /admin-api/pay/profit-recipient/list-by-shop` | 新增 | 查询店铺可选收款人列表 |

**权限**: `pay:profit-recipient:create` / `update` / `delete` / `query`

### 店铺分账绑定

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `PUT /admin-api/store/shop/bind-profit-recipient` | 修改 | 绑定/解绑店铺分账收款人；`enabled=false` 时 `recipientId` 必须为空，后端清空绑定 |

**权限**: `store:shop:update`（复用）

**请求参数规则**：
- `recipientId` 在 `enabled=true` 时必填，且必须是本店铺启用中的店铺级收款人。
- `recipientId` 在 `enabled=false` 时必须为空；后端会同步将 `profit_sharing_recipient_id` 与 `profit_sharing_enabled` 清空。

### 分账订单

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `GET /admin-api/pay/profit-sharing-order/page` | 新增 | 分账订单分页查询 |
| `GET /admin-api/pay/profit-sharing-order/get` | 新增 | 分账订单详情 |
| `POST /admin-api/pay/profit-sharing-order/retry` | 新增 | 失败分账手动重试 |

**权限**: `pay:profit-sharing:query` / `pay:profit-sharing:update`

### 分账计费规则管理

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `GET /admin-api/pay/profit-sharing-rule/list-by-shop` | 新增 | 按店铺查询分账计费规则列表。参数 `shopId` |
| `POST /admin-api/pay/profit-sharing-rule/save-set` | 新增 | 保存/覆盖店铺整套计费规则。请求体为完整规则集，后端原子性替换并整单校验 |

**权限**：`pay:profit-sharing-rule:query`、`pay:profit-sharing-rule:update`

校验规则（后端强制）：
- 同一店铺同一角色只能有一条生效记录；
- 不必 4 个角色全部存在，但至少启用一个角色；
- 启用角色的 `percentage` 之和必须等于 100；
- 有且仅有一个启用角色 `fee_bearer=1`；
- 手续费承担方角色必须已启用；
- 各角色取值范围：`role ∈ [1,2,3,4]`，`percentage ∈ [0, 100]`，`fee_bearer ∈ [0,1]`，`status ∈ [0,1]`。
- 单条规则 `status=0` 时，`fee_bearer` 必须同时为 0。  
- 分账金额校验时只汇总启用角色。  

### 内部调用

| 接口 | 调用方 → 被调用方 | 说明 |
|------|-------------------|------|
| `ProfitSharingOrderApi.createSharingOrder(DTO)` | order-biz → pay-api | 支付成功时创建待分账记录 |
| `ProfitRecipientApi.listByShop(Long shopId)` | store-biz → pay-api | 查询店铺可选收款人 |
| `ProfitSharingRuleApi.validateAndGetRules(Long shopId, BigDecimal payPrice)` | order-biz → pay-api | 校验规则完整性并返回计算后的分账明细；无规则时返回 fallback 标记 |
| `ProfitSharingRuleApi.isRuleComplete(Long shopId)` | store-biz → pay-api | 查询店铺计费规则是否完整有效，供店铺列表/详情展示 |
| `OrderApi.markOrderSettled(String orderId)` | pay-biz → order-api | 将 `yshop_store_order.status` 更新为 2（待评价） |

## DTO 变更

| DTO | 用途 | 关键字段 |
|-----|------|----------|
| `BankRespVO` | 银行列表项 | `bankCode`, `bankName`, `isPrimary` |
| `AdapayRegionRespVO` | Adapay 省市级联列表项 | `regionCode`, `regionName` |
| `AdapayRegionListReqVO` | Adapay 城市列表查询 | `provinceCode` |
| `ProfitRecipientCreateReqVO` | 创建收款人 | `recipientType`, `role`（仅平台级必填，店铺级不传）, `shopId`, `recipientName`, `memberType`, `memberInfo`（个人/企业不同；企业含 `socialCreditCode`/`socialCreditCodeExpires`/`businessScope`/`legalPerson`/`legalCertId`/`legalCertIdExpires`/`legalMp`/`address`/`licensePhotoUrl`/`idCardFrontUrl`/`idCardBackUrl`/`bankLicensePhotoUrl`，身份证支持 OCR 自动识别）, `settleAccount`（含 `cardNo`/`cardName`/`bankCode`/`adapayProvCode`/`adapayAreaCode`，银行选项来自后端银行列表，省市选项来自后端 Adapay 级联列表） |
| `ProfitRecipientUpdateReqVO` | 更新收款人 | `id`, `recipientName`, `status`, `settleAccount`（可选；仅更换结算账户时传入，传入后同步调用 Adapay 更新结算账户绑定；须含 `adapayProvCode`/`adapayAreaCode`） |
| `ProfitRecipientRespVO` | 收款人响应 | `id`, `recipientType`, `role`（平台级有值，店铺级为 null）, `shopId`, `recipientName`, `memberType`, `memberId`（按编码规则生成）, `settleAccountBound`, `settleAccountId`, `settleAccountSummary`, `status` |
| `ProfitRecipientPageReqVO` | 收款人分页查询 | `recipientType`, `role`（仅平台级查询时可用）, `shopId`, `status`, `recipientName` |
| `ShopBindProfitRecipientReqVO` | 店铺绑定 | `shopId`, `recipientId`, `enabled`；`recipientId` 必须为 `shopId` 对应的店铺级收款人 |
| `ProfitSharingOrderRespVO` | 分账订单响应 | `orderId`, `shopId`, `payPrice`, `commissionAmount`, `shopAmount`, `sharingStatus`, `fallbackRevenue`, `errorMsg`, `calculationType`, `feeBearerRole`, `items` |
| `ProfitSharingOrderPageReqVO` | 分账订单查询 | `orderId`, `shopId`, `sharingStatus`, `startTime`, `endTime` |
| `ProfitSharingRetryReqVO` | 重试分账 | `id` |
| `CreateSharingOrderDTO` | 内部 DTO | `orderId`, `shopId`, `payPrice`, `commissionAmount`, `platformRecipientId`, `shopRecipientId`, `adapayPaymentId`, `tenantId`, `calculationType`, `feeBearerRole`, `items` |
| `ProfitSharingRuleRespVO` | 规则响应 | `id`, `shopId`, `role`, `percentage`, `feeBearer`, `status` |
| `ProfitSharingRuleSaveReqVO` | 保存整套规则 | `shopId`, `rules: List<ProfitSharingRuleItemVO>` |
| `ProfitSharingRuleItemVO` | 单条规则项 | `role`, `percentage`, `feeBearer` |
| `ProfitSharingRuleItemDTO` | 内部计算结果 | `role`, `recipientId`, `amount`, `feeFlag` |
| `ProfitSharingOrderItemRespVO` | 分账明细响应 | `role`, `recipientId`, `amount`, `feeFlag` |
| `CreateSharingOrderItemDTO` | 内部分账明细 | `role`, `recipientId`, `amount`, `feeFlag` |

**字段校验要点**：
- `recipientType`: `[1, 2]`；`role`: `[1, 2, 3]`，`recipientType=1`（平台级）时必填，`recipientType=2`（店铺级）时不传/忽略
- `memberType`: `[1, 2]`
- `shopId`: `recipientType=2` 时必填，`recipientType=1` 时必须为 null
- `memberInfo`: 个人需 `phone`/`realName`/`idCard`；企业需 `socialCreditCode`/`socialCreditCodeExpires`/`businessScope`/`legalPerson`/`legalCertId`/`legalCertIdExpires`/`legalMp`/`address`/`licensePhotoUrl`/`idCardFrontUrl`/`idCardBackUrl`/`bankLicensePhotoUrl`；后端将四张图片打包为 zip 并 URLEncode 中文文件名后上传 Adapay
- `settleAccount`: 创建收款人时必填；更新收款人时可选，仅表示更换结算账户。传入时需包含 `cardNo`/`cardName`/`bankCode`/`adapayProvCode`/`adapayAreaCode`；`bankCode` 必须存在于 `yshop_pay_bank` 且状态启用，`adapayProvCode`/`adapayAreaCode` 必须存在于 `yshop_pay_adapay_region` 且状态启用。
- `settleAccountSummary`: 响应侧脱敏摘要，可包含 `cardNoMask`/`cardNameMask`/`bankCode`/`bankName`/`accountType`/`adapayProvCode`/`adapayAreaCode`/`adapayProvName`/`adapayAreaName`；不得返回完整旧银行卡号
- `recipientName`: 1-64 字符
- `member_id` 编码规则：`m_{tenantId}_{memberType}_{idCard}_{storeId}`，平台级 `storeId=0`

**字段校验要点（新增）**：
- 计费规则：`role ∈ [1,2,3,4]`，`percentage ∈ [0, 100]`，启用角色比例和 = 100，有且仅有一个启用角色 `fee_bearer=1`，禁用角色 `fee_bearer=0`。
- 分账明细：`amount` 之和必须等于 `payPrice`（只汇总启用角色）。

### 枚举新增

| 枚举 | 新增值 |
|------|--------|
| `ProfitSharingRoleEnum` | `PLATFORM(1)`, `SHOP(2)`, `DELIVERY(3)`, `SALES(4)` |
| `ProfitSharingCalculationTypeEnum` | `RULE(1)`, `COMMISSION_FALLBACK(2)` |

## 依赖变更

| 依赖 | 变更 | 说明 |
|------|------|------|
| `yshop-module-pay-biz` → `yshop-module-order-api` | 新增 | 调用 `OrderApi.markOrderSettled` 更新订单状态 |
| `yshop-module-order-biz` → `yshop-module-pay-api` | 已存在 | 调用 `ProfitSharingRuleApi` / `ProfitSharingOrderApi` / `ProfitRecipientApi` |

无新增外部 SDK 或第三方依赖。

## 数据库变更

- 既有迁移脚本：`sql/upgrade-adapay-profit-sharing.sql`（分账收款人、分账订单、日志、店铺扩展字段）、`sql/upgrade-adapay-profit-sharing-bank.sql`（银行字典表）、`sql/upgrade-adapay-profit-sharing-settle-account-replacement.sql`（结算账户更换快照字段）、`sql/upgrade-adapay-profit-sharing-rule.sql`（分账计费规则）。
- 本次新增迁移脚本：`sql/upgrade-adapay-profit-sharing-region.sql`
  - 新建 `yshop_pay_adapay_region`
  - 从 Adapay 省市编码 JSON 初始化 34 个省份、378 个城市
- **回滚方案**：
  1. `DROP TABLE yshop_pay_adapay_region;`

### 新建表

**`yshop_adapay_profit_sharing_rule`** — 店铺分账计费规则

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK AUTO_INCREMENT | |
| `tenant_id` | bigint NOT NULL | 租户隔离 |
| `shop_id` | bigint NOT NULL | 关联 `yshop_store_shop.id` |
| `role` | tinyint NOT NULL | 角色：1=平台，2=店铺，3=配送方，4=销售方 |
| `percentage` | decimal(5,2) NOT NULL | 分账比例(%) |
| `fee_bearer` | tinyint NOT NULL DEFAULT 0 | 是否承担手续费：0=否，1=是 |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=禁用，1=启用 |
| `creator` / `updater` | varchar(64) | |
| `create_time` / `update_time` | datetime NOT NULL | |
| `deleted` | tinyint NOT NULL DEFAULT 0 | 逻辑删除 |

索引：`idx_tenant_shop_status` (`tenant_id`, `shop_id`, `status`)，`idx_tenant_shop_role` (`tenant_id`, `shop_id`, `role`)，`uk_tenant_shop_role_deleted` (`tenant_id`, `shop_id`, `role`, `deleted`)

**`yshop_pay_bank`** — 银行字典表（Adapay 支持银行列表）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `bank_code` | varchar(16) NOT NULL | 银行编码，唯一 |
| `bank_name` | varchar(128) NOT NULL | 银行名称 |
| `is_primary` | tinyint NOT NULL DEFAULT 0 | 是否主要银行：0=否, 1=是。主要银行默认加载，非主要银行通过关键字搜索 |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=禁用, 1=启用 |
| `create_time` / `update_time` | datetime NOT NULL | |

索引：`uk_bank_code` (`bank_code` 唯一)，`idx_is_primary_status` (`is_primary`, `status`)

**`yshop_pay_adapay_region`** — Adapay 省市字典表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK AUTO_INCREMENT | |
| `region_code` | varchar(16) NOT NULL | 地区编码，Adapay 自定义四位 |
| `region_name` | varchar(128) NOT NULL | 地区名称 |
| `region_type` | tinyint NOT NULL | 类型：1=省份，2=城市 |
| `parent_code` | varchar(16) NULL | 父级编码；省份为 NULL，城市为所属省份编码 |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=禁用, 1=启用 |
| `create_time` / `update_time` | datetime NOT NULL | |

索引：`uk_region_code` (`region_code` 唯一)，`idx_region_type_status` (`region_type`, `status`)，`idx_parent_code_status` (`parent_code`, `status`)

**`yshop_adapay_profit_recipient`** — 分账收款人

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `tenant_id` | bigint NOT NULL | 租户隔离 |
| `recipient_type` | tinyint NOT NULL DEFAULT 1 | 1=平台级, 2=店铺级 |
| `member_social_credit_code` | varchar(32) NULL | 统一社会信用代码 |
| `member_social_credit_code_expires` | varchar(8) NULL | 统一社会信用代码有效期 |
| `member_business_scope` | varchar(200) NULL | 经营范围 |
| `member_legal_person` | varchar(20) NULL | 法人姓名 |
| `member_legal_cert_id` | varchar(20) NULL | 法人身份证号 |
| `member_legal_cert_id_expires` | varchar(16) NULL | 法人身份证有效期 |
| `member_legal_mp` | varchar(11) NULL | 法人手机号 |
| `member_address` | varchar(256) NULL | 企业地址 |
| `member_license_photo_url` | varchar(512) NULL | 三证合一证件照 URL |
| `member_id_card_front_url` | varchar(512) NULL | 法人身份证正面照 URL |
| `member_id_card_back_url` | varchar(512) NULL | 法人身份证反面照 URL |
| `member_bank_license_photo_url` | varchar(512) NULL | 开户银行许可证照 URL |
| `role` | tinyint NULL | 平台级必填：1=平台, 2=配送方, 3=销售方；店铺级为 NULL |
| `shop_id` | bigint NULL | 店铺级时关联门店；平台级为 NULL |
| `recipient_name` | varchar(64) NOT NULL | |
| `member_type` | tinyint NOT NULL DEFAULT 1 | 1=个人, 2=企业 |
| `member_id` | varchar(64) NOT NULL | 本地编码 `m_{tenantId}_{memberType}_{idCard}_{storeId\|0}` |
| `status` | tinyint NOT NULL DEFAULT 1 | 0=禁用, 1=启用 |
| `settle_account_bound` | tinyint NOT NULL DEFAULT 0 | 0=未绑定, 1=已绑定 |
| `settle_account_id` | varchar(64) NULL | Adapay 结算账户 ID |
| `settle_account_card_no_mask` | varchar(32) NULL | 银行卡号脱敏摘要，仅用于后台展示 |
| `settle_account_card_name_mask` | varchar(64) NULL | 开户名脱敏摘要，仅用于后台展示 |
| `settle_account_bank_code` | varchar(32) NULL | 银行编码 |
| `settle_account_bank_name` | varchar(128) NULL | 银行名称 |
| `settle_account_account_type` | tinyint NULL | 账户类型 |
| `settle_account_adapay_prov_code` | varchar(16) NULL | 开户省份编码（Adapay 自定义四位编码） |
| `settle_account_adapay_area_code` | varchar(16) NULL | 开户城市编码（Adapay 自定义四位编码） |
| `member_phone_snapshot` | varchar(32) NULL | Adapay 更换结算账户所需的 Member 手机号快照，禁止用于页面明文展示 |
| `member_cert_id_snapshot` | varchar(64) NULL | Adapay 更换结算账户所需的 Member 证件号快照，禁止用于页面明文展示 |
| `member_cert_type_snapshot` | varchar(16) NULL | Adapay 更换结算账户所需的 Member 证件类型快照 |
| `create_time` / `update_time` | datetime NOT NULL | |
| `deleted` | tinyint NOT NULL DEFAULT 0 | |

索引：`idx_tenant_role_status` (`tenant_id`, `role`, `status`；店铺级 role 为 NULL 不命中此索引), `idx_tenant_shop` (`tenant_id`, `shop_id`, `status`), `idx_member_id` (`member_id`)

**`yshop_adapay_profit_sharing_order`** — 分账订单

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `tenant_id` | bigint NOT NULL | |
| `order_id` | varchar(32) NOT NULL | 关联 `yshop_store_order.order_id` |
| `shop_id` | bigint NOT NULL | |
| `pay_price` | decimal(10,2) NOT NULL | |
| `commission_amount` | decimal(10,2) NOT NULL | 平台抽成 |
| `shop_amount` | decimal(10,2) NOT NULL | = pay_price - commission_amount |
| `platform_recipient_id` | bigint NOT NULL | |
| `shop_recipient_id` | bigint NOT NULL | |
| `sharing_status` | tinyint NOT NULL DEFAULT 0 | 0=待分账, 1=分账中, 2=成功, 3=失败, 4=已回退 |
| `adapay_payment_id` | varchar(64) NULL | |
| `adapay_confirm_id` | varchar(64) NULL | |
| `sharing_time` | datetime NULL | |
| `error_msg` | varchar(512) NULL | |
| `fallback_revenue` | tinyint NOT NULL DEFAULT 0 | 0=未回退, 1=已回退 |
| `calculation_type` | tinyint NOT NULL DEFAULT 2 | 计算方式：1=计费规则，2=佣金比例回退 |
| `fee_bearer_role` | tinyint NULL | 手续费承担角色：1=平台，2=店铺，3=配送方，4=销售方 |
| `create_time` / `update_time` | datetime NOT NULL | |

索引：`idx_tenant_order` (`tenant_id`, `order_id`), `idx_tenant_status_time` (`tenant_id`, `sharing_status`, `create_time`), `idx_tenant_shop` (`tenant_id`, `shop_id`)

**`yshop_adapay_profit_sharing_log`** — 分账操作日志

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `tenant_id` | bigint NOT NULL | |
| `sharing_order_id` | bigint NOT NULL | |
| `operation` | varchar(32) NOT NULL | CREATE/EXECUTE/QUERY/ROLLBACK |
| `request_data` | text NULL | JSON |
| `response_data` | text NULL | JSON |
| `result` | tinyint NOT NULL | 0=失败, 1=成功 |
| `create_time` | datetime NOT NULL | |

索引：`idx_sharing_order_id` (`sharing_order_id`)

**`yshop_adapay_profit_sharing_order_item`** — 分账订单明细

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK AUTO_INCREMENT | |
| `tenant_id` | bigint NOT NULL | 租户隔离 |
| `sharing_order_id` | bigint NOT NULL | 关联 `yshop_adapay_profit_sharing_order.id` |
| `role` | tinyint NOT NULL | 角色：1=平台，2=店铺，3=配送方，4=销售方 |
| `recipient_id` | bigint NOT NULL | 关联 `yshop_adapay_profit_recipient.id` |
| `amount` | decimal(10,2) NOT NULL | 该角色分账金额 |
| `fee_flag` | tinyint NOT NULL DEFAULT 0 | 是否承担手续费：0=N，1=Y |
| `creator` / `updater` | varchar(64) | |
| `create_time` / `update_time` | datetime NOT NULL | |
| `deleted` | tinyint NOT NULL DEFAULT 0 | 逻辑删除 |

索引：`idx_sharing_order_id` (`sharing_order_id`)，`idx_tenant_sharing_order` (`tenant_id`, `sharing_order_id`)

### 修改表

**`yshop_adapay_profit_sharing_order`** — 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `calculation_type` | tinyint NOT NULL DEFAULT 2 | 计算方式：1=计费规则，2=佣金比例回退 |
| `fee_bearer_role` | tinyint NULL | 手续费承担角色 |

**`yshop_store_shop`** — 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `profit_sharing_recipient_id` | bigint NULL | 关联分账收款人 |
| `profit_sharing_enabled` | tinyint NOT NULL DEFAULT 0 | 0=未启用, 1=已启用 |

### 菜单与权限

在 `sql/upgrade-adapay-profit-sharing-rule.sql` 中追加：

```sql
INSERT IGNORE INTO system_menu (id, name, permission, type, sort, parent_id, path, icon, component, component_name, status, visible, keep_alive, creator, create_time, updater, update_time, deleted) VALUES
(2508, '店铺分账计费规则', '', 2, 15, 2314, 'profit-sharing-rule', 'ep:money', '/mall/store/profitSharingRule/index', 'ProfitSharingRule', 0, 1, 1, 'admin', NOW(), 'admin', NOW(), 0),
(2509, '店铺分账计费规则查询', 'pay:profit-sharing-rule:query', 3, 1, 2508, '', '', '', NULL, 0, 1, 1, 'admin', NOW(), 'admin', NOW(), 0),
(2510, '店铺分账计费规则编辑', 'pay:profit-sharing-rule:update', 3, 2, 2508, '', '', '', NULL, 0, 1, 1, 'admin', NOW(), 'admin', NOW(), 0);

INSERT IGNORE INTO system_role_menu (role_id, menu_id, creator, create_time, updater, update_time, deleted, tenant_id) VALUES
(1, 2508, 'admin', NOW(), 'admin', NOW(), 0, 1),
(1, 2509, 'admin', NOW(), 'admin', NOW(), 0, 1),
(1, 2510, 'admin', NOW(), 'admin', NOW(), 0, 1);
```

## 错误码

| 错误码 | 含义 |
|--------|------|
| `PROFIT_RECIPIENT_NOT_EXISTS` | 收款人不存在 |
| `PROFIT_RECIPIENT_BOUND` | 收款人已被店铺绑定，无法删除 |
| `PROFIT_RECIPIENT_MEMBER_CREATE_FAILED` | Adapay Member 创建失败 |
| `PROFIT_RECIPIENT_SETTLE_ACCOUNT_FAILED` | Adapay 结算账户绑定失败 |
| `PROFIT_RECIPIENT_MEMBER_INFO_REQUIRED` | 分账收款人 Member 信息不完整 |
| `PROFIT_RECIPIENT_SETTLE_ACCOUNT_REQUIRED` | 结算账户信息不完整 |
| `PROFIT_SHARING_ORDER_NOT_EXISTS` | 分账订单不存在 |
| `PROFIT_SHARING_STATUS_INVALID` | 分账状态不允许操作 |
| `PROFIT_SHARING_RECIPIENT_MISSING` | 角色有效收款人未配置 |
| `PROFIT_SHARING_SHOP_RECIPIENT_MISSING` | 店铺未绑定收款人 |
| `PROFIT_SHARING_AMOUNT_MISMATCH` | 分账金额校验失败 |
| `PROFIT_SHARING_PAY_DISABLED` | 分账配置不完整，禁止支付 |
| `BANK_NOT_EXISTS` | 银行编码不存在或已禁用 |
| `ADAPAY_REGION_PROVINCE_NOT_EXISTS` | Adapay 省份编码不存在或已禁用 |
| `ADAPAY_REGION_CITY_NOT_EXISTS` | Adapay 城市编码不存在、已禁用或不属于指定省份 |
| `ADAPAY_REGION_CITY_PROVINCE_MISMATCH` | Adapay 城市编码与省份编码不匹配 |
| `PROFIT_RECIPIENT_ID_CARD_OCR_FAILED` | 法人身份证 OCR 识别失败 |
| `PROFIT_RECIPIENT_ATTACH_FILE_INVALID` | 企业 Member 附件不符合要求（非 zip、缺图片、超大等） |
| `PROFIT_SHARING_RULE_INCOMPLETE` | 店铺计费规则不完整（无启用角色、启用角色比例和 ≠100、承担方不唯一或未启用等） |
| `PROFIT_SHARING_RULE_ROLE_EXISTS` | 同一店铺同一角色已存在生效规则 |
| `PROFIT_SHARING_RULE_FEE_BEARER_INVALID` | 手续费承担方配置不合法（承担方角色未启用，或存在多个承担方） |
| `PROFIT_SHARING_RECIPIENT_MISSING_FOR_ROLE` | 某启用角色未配置有效收款人 |
| `PROFIT_SHARING_ORDER_STATUS_INVALID_FOR_RETRY` | 当前分账状态不允许重试 |
| `ORDER_SETTLE_FAILED` | 订单状态更新为待评价失败 |

> 具体数值由 backend-agent 实现时按模块错误码段分配。

## 银行列表

`settleAccount.bankCode` 选项来自后端银行字典表 `yshop_pay_bank`，通过 `GET /admin-api/pay/bank/list` 获取。初始数据从 `governance/feature-docs/adapay-profit-sharing/bank-list.json` 经迁移脚本 `sql/upgrade-adapay-profit-sharing-bank.sql` 导入。

`settleAccount.adapayProvCode`/`adapayAreaCode` 选项来自后端 Adapay 省市字典表 `yshop_pay_adapay_region`，通过 `GET /admin-api/pay/adapay-region/province-list` 与 `GET /admin-api/pay/adapay-region/city-list?provinceCode=xxx` 获取。初始数据从 `governance/feature-docs/adapay-profit-sharing/region-list.json` 经迁移脚本 `sql/upgrade-adapay-profit-sharing-region.sql` 导入。

格式：`[{ "regionCode": "0011", "regionName": "北京市" }, ...]`，共 34 个省份、378 个城市。

**加载策略**：默认仅返回 `is_primary=1` 且 `status=1` 的银行（约数十条），避免全量数据导致前端表单卡顿。用户输入关键字时，后端对全部启用银行做 `bank_code LIKE %keyword% OR bank_name LIKE %keyword%` 模糊匹配并返回结果。

省市级联：省份列表一次性返回 34 条；选择省份后按 `provinceCode` 查询该省城市列表，最多约 30 条，前端即时加载无压力。

> 前端银行选择器使用远程搜索模式，不再全量加载。创建/更新收款人时后端强制校验 `bankCode`/`adapayProvCode`/`adapayAreaCode` 必须存在且启用；`adapayAreaCode` 的父级必须与 `adapayProvCode` 一致。

## 兼容性

- **向后兼容**：是。未启用分账的店铺行为不变；已启用分账但无计费规则的店铺 fallback 到原有 `commission_rate` 逻辑；新增表不影响现有查询。已配置规则但规则不完整（无启用角色、启用角色比例和 ≠100、无唯一启用承担方、承担方未启用、收款人缺失/禁用）时，支付时拒绝并提示配置缺失，不得静默 fallback。禁用某角色后，历史已创建的分账记录金额不受影响。
- **前端同步变更**：
  - `admin/` 需新增「店铺分账计费规则」页面（菜单挂于门店管理下）；
  - 分账收款人管理和分账订单查询页面保持原有功能；
  - 店铺编辑页新增「分账计费规则」配置入口；
  - 分账结算记录详情页展示 `calculationType`、`feeBearerRole` 与分账明细 `items`；
  - 银行下拉继续调用后端 API；分账收款人表单的结算账户区域增加「开户省份」「开户城市」Adapay 级联选择。
- **`miniapp/` 无变更**，C 端用户无感知。
