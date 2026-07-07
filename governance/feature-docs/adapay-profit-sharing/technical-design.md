# 技术设计：Adapay 分账结算

## 概述

本设计实现基于 Adapay 三方支付的延迟分账与日终自动结算功能。核心流程：支付时挂起分账 → 日终按店铺抽成比例执行分账 → 资金从平台账户划转至多个收款人账户。

## 数据库变更

### 新建表

#### 1. `yshop_adapay_profit_recipient` — 分账收款人

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | PK, auto_increment | 收款人ID |
| `tenant_id` | bigint | NOT NULL, index | 租户隔离 |
| `recipient_type` | tinyint | NOT NULL, default 1 | 1=平台级, 2=店铺级 |
| `role` | tinyint | NOT NULL, default 1 | 1=平台, 2=配送方, 3=销售方 |
| `shop_id` | bigint | NULL, index | 店铺级时关联 `yshop_store_shop.id`；平台级为 NULL |
| `recipient_name` | varchar(64) | NOT NULL | 收款人名称 |
| `member_type` | tinyint | NOT NULL, default 1 | 1=个人, 2=企业 |
| `member_id` | varchar(64) | NOT NULL | Adapay 返回的 member_id（app_id 下唯一） |
| `status` | tinyint | NOT NULL, default 1 | 0=禁用, 1=启用 |
| `settle_account_bound` | tinyint | NOT NULL, default 0 | 0=未绑定结算账户, 1=已绑定 |
| `settle_account_id` | varchar(64) | NULL | Adapay 返回的结算账户 ID |
| `create_time` | datetime | NOT NULL | 创建时间 |
| `update_time` | datetime | NOT NULL | 更新时间 |
| `deleted` | tinyint | NOT NULL, default 0 | 逻辑删除 |

**索引**: `idx_tenant_role_status` (`tenant_id`, `role`, `status`), `idx_tenant_shop` (`tenant_id`, `shop_id`, `status`), `idx_member_id` (`member_id`)

**唯一约束**: `uniq_tenant_role_active` — 同一租户同一角色只能有一个 `status=1` 的收款人。
实现方式：业务层校验 + 创建时将该角色下其他 `status=1` 记录置为 `status=0`。

#### 2. `yshop_adapay_profit_sharing_order` — 分账订单记录

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | PK, auto_increment | 分账记录ID |
| `tenant_id` | bigint | NOT NULL, index | 租户隔离 |
| `order_id` | varchar(32) | NOT NULL, index | 关联 `yshop_store_order.order_id` |
| `shop_id` | bigint | NOT NULL, index | 关联门店ID |
| `pay_price` | decimal(10,2) | NOT NULL | 订单实付金额 |
| `commission_amount` | decimal(10,2) | NOT NULL | 平台抽成金额 |
| `shop_amount` | decimal(10,2) | NOT NULL | 店铺分账金额（= pay_price - commission_amount） |
| `platform_recipient_id` | bigint | NOT NULL | 平台角色分账收款人ID |
| `shop_recipient_id` | bigint | NOT NULL | 店铺绑定的分账收款人ID |
| `sharing_status` | tinyint | NOT NULL, default 0 | 0=待分账, 1=分账中, 2=分账成功, 3=分账失败, 4=已回退 |
| `adapay_payment_id` | varchar(64) | NULL | Adapay 支付对象 ID（用于确认分账） |
| `adapay_confirm_id` | varchar(64) | NULL | Adapay 支付确认（分账）对象 ID |
| `sharing_time` | datetime | NULL | 实际分账时间 |
| `error_msg` | varchar(512) | NULL | 失败原因 |
| `fallback_revenue` | tinyint | NOT NULL, default 0 | 0=未走虚拟余额回退, 1=已回退到 RevenueJob |
| `create_time` | datetime | NOT NULL | 创建时间 |
| `update_time` | datetime | NOT NULL | 更新时间 |

**索引**: `idx_tenant_order` (`tenant_id`, `order_id`), `idx_tenant_status_time` (`tenant_id`, `sharing_status`, `create_time`), `idx_tenant_shop` (`tenant_id`, `shop_id`)

#### 3. `yshop_adapay_profit_sharing_log` — 分账操作日志

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | PK, auto_increment | 日志ID |
| `tenant_id` | bigint | NOT NULL | 租户隔离 |
| `sharing_order_id` | bigint | NOT NULL, index | 关联分账订单记录ID |
| `operation` | varchar(32) | NOT NULL | 操作类型：CREATE/EXECUTE/QUERY/ROLLBACK |
| `request_data` | text | NULL | 请求数据（JSON） |
| `response_data` | text | NULL | 响应数据（JSON） |
| `result` | tinyint | NOT NULL | 0=失败, 1=成功 |
| `create_time` | datetime | NOT NULL | 创建时间 |

**索引**: `idx_sharing_order_id` (`sharing_order_id`)

### 修改表

#### `yshop_store_shop` — 门店表

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `profit_sharing_recipient_id` | bigint | NULL, default NULL | 关联的分账收款人ID（`yshop_adapay_profit_recipient.id`） |
| `profit_sharing_enabled` | tinyint | NOT NULL, default 0 | 0=未启用分账, 1=已启用分账 |

#### `yshop_store_order` — 订单表（已有字段复用）

已有 `commission_amount` 字段用于计算分账。支付成功时写入分账记录，无需新增字段。

## API 设计

### Admin API（管理后台）

#### 分账收款人管理

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin-api/pay/profit-recipient/create` | `pay:profit-recipient:create` | 创建分账收款人 |
| PUT | `/admin-api/pay/profit-recipient/update` | `pay:profit-recipient:update` | 更新分账收款人 |
| DELETE | `/admin-api/pay/profit-recipient/delete` | `pay:profit-recipient:delete` | 删除分账收款人 |
| GET | `/admin-api/pay/profit-recipient/get` | `pay:profit-recipient:query` | 获取单个收款人 |
| GET | `/admin-api/pay/profit-recipient/page` | `pay:profit-recipient:query` | 分页查询收款人 |
| GET | `/admin-api/pay/profit-recipient/list-by-shop` | `pay:profit-recipient:query` | 查询店铺可用收款人列表 |

**Create/Update Request Body**:
```json
{
  "recipientType": 1,
  "role": 1,
  "shopId": null,
  "recipientName": "平台账户",
  "memberType": 1,
  "memberInfo": {
    "phone": "13800138000",
    "realName": "张三",
    "idCard": "310101199001011234",
    "idCardType": "IDCARD"
  },
  "settleAccount": {
    "cardNo": "622202************",
    "cardName": "张三",
    "bankCode": "ICBC",
    "bankName": "中国工商银行",
    "branch": "上海分行",
    "accountType": 1
  },
  "status": 1
}
```

**字段说明**:
- `recipientType`: 1=平台级, 2=店铺级
- `role`: 1=平台, 2=配送方, 3=销售方
- `shopId`: 店铺级时必填；平台级必须为 null
- `memberType`: 1=个人, 2=企业
- `memberInfo`: 个人/企业实名信息；企业时包含 `corpName`/`businessLicenseNo`/`legalName`/`legalIdCard`/`attachFileUrl` 等
- `settleAccount`: 结算银行卡信息，创建时必填
- `status`: 0=禁用, 1=启用

**企业 Member 请求示例**:
```json
{
  "recipientType": 1,
  "role": 1,
  "recipientName": "平台公司",
  "memberType": 2,
  "memberInfo": {
    "corpName": "上海某某科技有限公司",
    "businessLicenseNo": "91310000********",
    "legalName": "李四",
    "legalIdCard": "310101198001011234",
    "attachFileUrl": "https://.../license.zip"
  },
  "settleAccount": { ... },
  "status": 1
}
```

**Response**: `CommonResult<Long>` (创建返回ID)

**创建流程**:
1. 校验 `recipientType`/`role`/`shopId` 一致性。
2. 同角色平台级收款人唯一性校验（启用时）。
3. 根据当前租户的 Adapay 商户配置，构造 `AdapayPayService`。
4. 调用 `AdapayPayService.createDivMember(params)` 或 `createCorpDivMember(params, file)` 创建 Member，获取 `member_id`。
5. 使用返回的 `member_id`，调用 `AdapayPayService.createDivSettleAccount(params)` 绑定结算银行卡，获取 `settle_account_id`。
6. 将 `member_id`、`settle_account_id`、`settle_account_bound=1` 写入 `yshop_adapay_profit_recipient`。
7. 若第 4 或第 5 步失败，直接抛出错误，不入库。

#### 店铺分账配置

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| PUT | `/admin-api/store/shop/bind-profit-recipient` | `store:shop:update` | 店铺绑定分账收款人 |

**Request Body**:
```json
{
  "shopId": 1,
  "recipientId": 2,
  "enabled": true
}
```

#### 分账订单查询

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin-api/pay/profit-sharing-order/page` | `pay:profit-sharing:query` | 分页查询分账订单 |
| GET | `/admin-api/pay/profit-sharing-order/get` | `pay:profit-sharing:query` | 获取分账订单详情 |
| POST | `/admin-api/pay/profit-sharing-order/retry` | `pay:profit-sharing:update` | 手动重试失败分账 |

### App/Internal API

无新增 C-end 接口。分账流程对小程序用户完全透明。

### DTOs

- `ProfitRecipientCreateReqVO` / `ProfitRecipientUpdateReqVO` / `ProfitRecipientRespVO`
- `ProfitRecipientMemberInfo` / `ProfitRecipientSettleAccount`
- `ProfitRecipientPageReqVO`
- `ShopBindProfitRecipientReqVO`
- `ProfitSharingOrderRespVO` / `ProfitSharingOrderPageReqVO`
- `ProfitSharingRetryReqVO`
- `CreateSharingOrderDTO` (Internal API)

## 模块影响

### 变更模块

| 模块 | 变更内容 |
|------|----------|
| `yshop-module-pay-biz` | 新增分账收款人 Controller/Service/Mapper；新增分账订单 Service；新增 Adapay 分账 SDK 调用封装（`Payment.create` delay, `PaymentConfirm.create`）；新增 Adapay Member 与结算账户创建封装；新增日终结算 Job；新增分账失败回退到 RevenueJob 逻辑 |
| `yshop-module-pay-api` | 新增分账相关 DTO、Service 接口、ErrorCode |
| `yshop-module-store-biz` | 店铺绑定分账收款人接口；店铺查询时返回分账启用状态 |
| `yshop-module-store-api` | 店铺绑定分账收款人 DTO |
| `yshop-module-order-biz` | `paySuccess()` 中 Adapay 支付且店铺启用分账时，创建分账挂起记录；校验收款人配置 |
| `yshop-module-mall` (sql) | 新增 `sql/upgrade-adapay-profit-sharing.sql` |

### 跨模块依赖（遵循 `-api` 模块规则）

```
yshop-module-order-biz ──→ yshop-module-pay-api (ProfitSharingOrderApi)
                              ↑
                    yshop-module-pay-biz (实现)

yshop-module-store-biz ──→ yshop-module-pay-api (ProfitRecipientApi)
                              ↑
                    yshop-module-pay-biz (实现)
```

- `order-biz` 依赖 `pay-api` 的 `ProfitSharingOrderApi` 接口创建分账记录
- `store-biz` 依赖 `pay-api` 的 `ProfitRecipientApi` 接口查询收款人列表

## 时序图

### 1. 创建分账收款人并绑定店铺

```
Admin ──→ [POST] /admin-api/pay/profit-recipient/create
            │  选择 Member 类型（个人/企业），填写实名/企业信息
            │  填写结算银行卡信息
            ▼
        yshop-module-pay-biz
            │  校验字段与唯一性
            │  加载当前租户 Adapay 商户配置
            │  调用 AdapayPayService.createDivMember / createCorpDivMember
            ▼
        Adapay 平台
            │  返回 member_id
            ▼
        yshop-module-pay-biz
            │  使用 member_id 调用 createDivSettleAccount
            ▼
        Adapay 平台
            │  返回 settle_account_id
            ▼
        yshop-module-pay-biz
            │  写入 yshop_adapay_profit_recipient
            │  保存 member_id + settle_account_id
            │  同角色其他 status=1 记录置为 status=0
            ▼
Admin ←── CommonResult<Long>

Admin ──→ [PUT] /admin-api/store/shop/bind-profit-recipient
            │  {shopId, recipientId, enabled: true}
            ▼
        yshop-module-store-biz
            │  更新 yshop_store_shop.profit_sharing_recipient_id
            │  更新 yshop_store_shop.profit_sharing_enabled = 1
            ▼
Admin ←── CommonResult<Boolean>
```

### 2. 支付时延迟分账

```
MiniApp ──→ [POST] /app-api/order/pay
              │  payType = ADAPAY
              ▼
          yshop-module-order-biz
              │  校验店铺分账收款人配置
              │  创建 Adapay 支付订单
              │  pay_mode = delay
              ▼
          Adapay 平台
              │  用户完成支付
              │  资金冻结在平台账户
              ▼
          Adapay ──→ 异步回调
              ▼
          yshop-module-pay-biz (AdapayPayMessageHandler)
              │  支付成功
              ▼
          yshop-module-order-biz (paySuccess)
              │  更新订单状态
              │  计算 commission_amount
              │  调用 ProfitSharingOrderApi.createSharingOrder()
              ▼
          yshop-module-pay-biz
              │  写入 yshop_adapay_profit_sharing_order
              │  status = 0 (待分账)
              │  记录平台收款人 + 店铺收款人
              ▼
          MiniApp ←── 支付成功响应
```

### 3. 日终自动结算分账

```
Quartz Scheduler ──→ 每日 00:05 触发
                      │
                      ▼
              yshop-module-pay-biz (ProfitSharingSettlementJob)
                      │  @TenantJob 多租户遍历
                      │  查询 sharing_status = 0 且 create_time < 今日 00:00 的记录
                      ▼
              遍历每个待分账订单（分页，每批 100）
                      │
                      ▼
              计算分账金额
                      │  platform_amount = commission_amount
                      │  shop_amount = pay_price - commission_amount
                      ▼
              调用 Adapay PaymentConfirm.create
                      │  payment_id: adapay_payment_id
                      │  order_no: 生成结算确认单号
                      │  confirm_amt: pay_price
                      │  div_members:
                      │    [{member_id: 平台member_id, amount: platform_amount, fee_flag: N},
                      │     {member_id: 店铺member_id, amount: shop_amount, fee_flag: N}]
                      ▼
              Adapay 平台
                      │  执行分账，资金划转
                      ▼
              yshop-module-pay-biz
                      │  更新 sharing_status = 2 (分账成功)
                      │  更新 adapay_confirm_id, sharing_time
                      │  写入分账日志
                      ▼
              若 Adapay 调用失败
                      │  更新 sharing_status = 3 (分账失败)
                      │  记录 error_msg
                      │  写入分账日志
                      │  调用 RevenueJob 回退：写入店铺收入（type=1）和平台抽成（type=3）
                      │  更新 fallback_revenue = 1
                      ▼
              Job 返回结算结果统计
```

## 状态机

### 分账订单状态 (sharing_status)

```
0 (待分账) ──→ 1 (分账中) ──→ 2 (分账成功)
                    │
                    └──→ 3 (分账失败) ──→ 4 (已回退)
                                         │
                                         └──→ 手动重试 → 1 (分账中)
```

- `0→1`: Job 开始执行分账
- `1→2`: Adapay 返回分账成功
- `1→3`: Adapay 返回分账失败
- `3→4`: 自动回退到 RevenueJob 后标记已回退
- `3→1`: 管理后台手动重试（未回退前）

## 关键决策

1. **延迟分账模式**：支付时设置 `pay_mode=delay`，资金冻结在平台账户，日终再执行分账确认。
2. **分账金额固化**：在 `yshop_adapay_profit_sharing_order` 创建时即计算并固化 `commission_amount`、`shop_amount`。
3. **平台级收款人角色化**：每个收款人带 `role` 字段；同一租户同一角色只能有一个 `status=1` 的有效收款人。
4. **分账失败兜底**：Adapay 分账失败后，自动回退到现有 `RevenueJob` 虚拟余额结算，保证店铺收入不丢失。
5. **支付前校验**：若店铺启用分账但缺少有效平台/店铺收款人，拒绝支付。
6. **Job 幂等**：`ProfitSharingSettlementJob` 通过 `sharing_status` 状态机保证幂等，同一订单不会重复分账。
7. **Member 与结算账户同步创建**：创建收款人时同步调用 Adapay 创建 Member 并绑定结算账户，避免后续分账因缺少结算账户失败。
8. **Member 类型区分**：支持个人/企业两种 Member，企业需上传附件。

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Adapay Member 创建失败 | 收款人无法入库 | 接口直接失败并返回错误；不入库 |
| 结算账户绑定失败 | 资金无法结算到银行卡 | 接口直接失败；不入库 |
| Adapay 分账 API 调用失败 | 资金无法划转 | 失败记录 `sharing_status=3`；自动回退 `RevenueJob`；支持管理后台手动重试 |
| 分账金额计算错误 | 平台或店铺资金损失 | 分账金额在创建时固化；增加校验：platform_amount + shop_amount == pay_price |
| 店铺未绑定收款人 | 支付被拒绝 | 支付时校验，明确错误提示 |
| 退款订单已分账 | 资金追回困难 | 本期 deferred；后续通过 Adapay `PaymentConfirmReverse` 实现 |
| 日终 Job 执行超时 | 大量订单堆积 | 分页处理，每批 100 条；Job 支持幂等执行 |
| 多租户数据隔离 | 跨租户资金操作 | 所有查询强制带 `tenant_id`；MyBatis Plus TenantLineInnerInterceptor 自动注入 |
| 企业 Member 附件存储 | 需要文件上传能力 | 复用现有文件存储接口，附件 URL 作为参数传入 |
