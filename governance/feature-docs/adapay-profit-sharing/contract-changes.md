# 契约变更 — Adapay 分账结算

## 端点变更

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
| `PUT /admin-api/store/shop/bind-profit-recipient` | 新增 | 绑定/解绑店铺分账收款人 |

**权限**: `store:shop:update`（复用）

### 分账订单

| 端点 | 变更类型 | 说明 |
|------|----------|------|
| `GET /admin-api/pay/profit-sharing-order/page` | 新增 | 分账订单分页查询 |
| `GET /admin-api/pay/profit-sharing-order/get` | 新增 | 分账订单详情 |
| `POST /admin-api/pay/profit-sharing-order/retry` | 新增 | 失败分账手动重试 |

**权限**: `pay:profit-sharing:query` / `pay:profit-sharing:update`

### 内部调用

| 接口 | 调用方 → 被调用方 | 说明 |
|------|-------------------|------|
| `ProfitSharingOrderApi.createSharingOrder(DTO)` | order-biz → pay-api | 支付成功时创建待分账记录 |
| `ProfitRecipientApi.listByShop(Long shopId)` | store-biz → pay-api | 查询店铺可选收款人 |

## DTO 变更

| DTO | 用途 | 关键字段 |
|-----|------|----------|
| `ProfitRecipientCreateReqVO` | 创建收款人 | `recipientType`, `role`（仅平台级必填，店铺级不传）, `shopId`, `recipientName`, `memberType`, `memberInfo`（个人/企业不同）, `settleAccount`（含 `cardNo`/`cardName`/`bankCode`，银行选项来自 Adapay 支持银行列表） |
| `ProfitRecipientUpdateReqVO` | 更新收款人 | `id`, `recipientName`, `status`, `settleAccount`（可选；仅更换结算账户时传入，传入后同步调用 Adapay 更新结算账户绑定） |
| `ProfitRecipientRespVO` | 收款人响应 | `id`, `recipientType`, `role`（平台级有值，店铺级为 null）, `shopId`, `recipientName`, `memberType`, `memberId`（按编码规则生成）, `settleAccountBound`, `settleAccountId`, `settleAccountSummary`, `status` |
| `ProfitRecipientPageReqVO` | 收款人分页查询 | `recipientType`, `role`（仅平台级查询时可用）, `shopId`, `status`, `recipientName` |
| `ShopBindProfitRecipientReqVO` | 店铺绑定 | `shopId`, `recipientId`, `enabled`；`recipientId` 必须为 `shopId` 对应的店铺级收款人 |
| `ProfitSharingOrderRespVO` | 分账订单响应 | `orderId`, `shopId`, `payPrice`, `commissionAmount`, `shopAmount`, `sharingStatus`, `fallbackRevenue`, `errorMsg` |
| `ProfitSharingOrderPageReqVO` | 分账订单查询 | `orderId`, `shopId`, `sharingStatus`, `startTime`, `endTime` |
| `ProfitSharingRetryReqVO` | 重试分账 | `id` |
| `CreateSharingOrderDTO` | 内部 DTO | `orderId`, `shopId`, `payPrice`, `commissionAmount`, `platformRecipientId`, `shopRecipientId`, `adapayPaymentId`, `tenantId` |

**字段校验要点**：
- `recipientType`: `[1, 2]`；`role`: `[1, 2, 3]`，`recipientType=1`（平台级）时必填，`recipientType=2`（店铺级）时不传/忽略
- `memberType`: `[1, 2]`
- `shopId`: `recipientType=2` 时必填，`recipientType=1` 时必须为 null
- `memberInfo`: 个人需 `phone`/`realName`/`idCard`；企业需 `corpName`/`businessLicenseNo`/`legalName`/`legalIdCard`/`attachFileUrl`
- `settleAccount`: 创建收款人时必填；更新收款人时可选，仅表示更换结算账户。传入时需包含 `cardNo`/`cardName`/`bankCode`；`bankCode` 来自 Adapay 支持银行列表（`governance/feature-docs/adapay-profit-sharing/bank-list.json`）
- `settleAccountSummary`: 响应侧脱敏摘要，可包含 `cardNoMask`/`cardNameMask`/`bankCode`/`bankName`/`accountType`；不得返回完整旧银行卡号
- `recipientName`: 1-64 字符
- `member_id` 编码规则：`m_{tenantId}_{memberType}_{idCard}_{storeId}`，平台级 `storeId=0`

## 依赖变更

无新增依赖。复用现有 Adapay SDK（已在 `ARCHITECTURE.md` 依赖登记册中）。

## 数据库变更

迁移脚本：`sql/upgrade-adapay-profit-sharing.sql`；本次结算账户更换澄清需补充迁移脚本 `sql/upgrade-adapay-profit-sharing-settle-account-replacement.sql`

### 新建表

**`yshop_adapay_profit_recipient`** — 分账收款人

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `tenant_id` | bigint NOT NULL | 租户隔离 |
| `recipient_type` | tinyint NOT NULL DEFAULT 1 | 1=平台级, 2=店铺级 |
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

### 修改表

**`yshop_store_shop`** — 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `profit_sharing_recipient_id` | bigint NULL | 关联分账收款人 |
| `profit_sharing_enabled` | tinyint NOT NULL DEFAULT 0 | 0=未启用, 1=已启用 |

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

> 具体数值由 backend-agent 实现时按模块错误码段分配。

## 银行列表

`settleAccount.bankCode` 选项来自 Adapay 支持银行列表，数据源为 `governance/feature-docs/adapay-profit-sharing/bank-list.json`（由 `Adapay支持银行列表.xlsx` 转换）。

格式：`[{ "bankCode": "01020000", "bankName": "中国工商银行" }, ...]`，共约 5260 条。

> 前端 `el-select` 使用此列表作为银行选项，绑定 `bankCode` 为值，显示 `bankCode + bankName`。

## 兼容性

- 向后兼容：是。未启用分账的店铺行为不变；新增表不影响现有查询。
- 前端同步变更：`admin/` 需新增分账收款人管理和分账订单查询页面；店铺编辑页新增分账配置区块。
- `miniapp/` 无变更。
