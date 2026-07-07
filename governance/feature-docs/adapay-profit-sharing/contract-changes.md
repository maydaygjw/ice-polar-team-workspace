# Contract Changes: Adapay 分账结算

## 文档层级

| 层级 | 文件 | 状态 |
|------|------|------|
| Platform | `CONTRACTS.md` | 复用（模块依赖规则、Admin API 前缀、通用响应结构、租户隔离规则） |
| Feature | 本文档 | 新增 |
| Machine | `CONTRACT/backend-api.json` | Phase 2 由 `extract-openapi` 自动生成 |

## 复用的平台级合约

以下规则直接引用 `CONTRACTS.md`，本 feature 不做变更：

- **模块依赖规则**：跨模块调用必须通过 `-api` 模块（`CONTRACTS.md#模块依赖规则`）
- **Admin API 前缀**：`/admin-api/...`
- **通用响应结构**：`{code: 0, data: {}, msg: "success"}`，其中 `code=0` 表示成功
- **租户隔离**：所有业务表包含 `tenant_id`，MyBatis Plus `TenantLineInnerInterceptor` 自动注入
- **门店权限层级**：`tenant → department → business-region → shop`（`CONTRACTS.md#Business Region 与门店权限合同`）
- **Commission Contract**：抽成比例优先级 `category > shop`，存储于 `yshop_store_shop.commission_rate` 和 `yshop_store_product_category.commission_rate`

## 新增 API 合约

### 枚举定义

#### Recipient Type / 收款人类型

| Value | Meaning |
|-------|---------|
| 1 | 平台级 |
| 2 | 店铺级 |

#### Recipient Role / 分账角色

| Value | Meaning |
|-------|---------|
| 1 | 平台 |
| 2 | 配送方 |
| 3 | 销售方 |

#### Member Type / Member 类型

| Value | Meaning |
|-------|---------|
| 1 | 个人 |
| 2 | 企业 |

#### Sharing Status / 分账状态

| Value | Meaning |
|-------|---------|
| 0 | 待分账 |
| 1 | 分账中 |
| 2 | 分账成功 |
| 3 | 分账失败 |
| 4 | 已回退 |

### 分账收款人管理

#### POST /admin-api/pay/profit-recipient/create

创建分账收款人。后端同步调用 Adapay 接口创建 Member 并绑定结算账户；成功后入库。创建 `status=1` 的**平台级**收款人时，同租户同角色下其他 `status=1` 的**平台级**收款人将被自动禁用。

**权限**: `pay:profit-recipient:create`

**Request Body**:
```json
{
  "recipientType": 1,
  "role": 1,
  "shopId": null,
  "recipientName": "平台分账账户",
  "memberType": 1,
  "memberInfo": {
    "phone": "13800138000",
    "realName": "张三",
    "idCard": "310101199001011234",
    "idCardType": "IDCARD"
  },
  "settleAccount": {
    "cardNo": "6222021234567890123",
    "cardName": "张三",
    "bankCode": "ICBC",
    "bankName": "中国工商银行",
    "branch": "上海分行",
    "accountType": 1
  },
  "status": 1
}
```

**字段校验**:
- `recipientType`: 必填，范围 `[1, 2]`
- `role`: 必填，范围 `[1, 2, 3]`
- `shopId`: `recipientType=2` 时必填；`recipientType=1` 时必须为 null
- `recipientName`: 必填，长度 `1-64`
- `memberType`: 必填，`1`=个人，`2`=企业
- `memberInfo`: 必填，内容随 `memberType` 变化
  - 个人：至少 `phone`、`realName`、`idCard`
  - 企业：至少 `corpName`、`businessLicenseNo`、`legalName`、`legalIdCard`、`attachFileUrl`
- `settleAccount`: 必填，至少 `cardNo`、`cardName`、`bankCode`
- `status`: 必填，范围 `[0, 1]`

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
  "settleAccount": {
    "cardNo": "1234567890123456",
    "cardName": "上海某某科技有限公司",
    "bankCode": "ICBC",
    "bankName": "中国工商银行",
    "branch": "上海分行",
    "accountType": 2
  },
  "status": 1
}
```

**Response**:
```json
{
  "code": 0,
  "data": 123,
  "msg": "success"
}
```
- `data`: 新建收款人ID（Long）

#### PUT /admin-api/pay/profit-recipient/update

更新分账收款人。`recipientType`、`role`、`shopId`、`memberType`、`memberId`、`settleAccountId` 不可变更；仅允许更新 `recipientName`、`status` 等非 Adapay 侧字段。若需变更 Member 信息或结算账户，应删除后重建。

**权限**: `pay:profit-recipient:update`

**Request Body**: 同 create，增加 `id` 字段；`memberInfo` 与 `settleAccount` 字段可忽略或仅做展示。

**Response**: `CommonResult<Boolean>`

#### DELETE /admin-api/pay/profit-recipient/delete

删除分账收款人。若该收款人已被店铺绑定，则拒绝删除。

**权限**: `pay:profit-recipient:delete`

**Query Params**:
- `id`: Long，必填

**Response**: `CommonResult<Boolean>`

**错误码**:
- `PROFIT_RECIPIENT_BOUND`: 收款人已被店铺绑定，无法删除

#### GET /admin-api/pay/profit-recipient/get

**权限**: `pay:profit-recipient:query`

**Query Params**:
- `id`: Long，必填

**Response**:
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "recipientType": 1,
    "role": 1,
    "shopId": null,
    "recipientName": "平台分账账户",
    "memberType": 1,
    "memberId": "m_xxx",
    "settleAccountBound": 1,
    "settleAccountId": "sa_xxx",
    "status": 1,
    "createTime": "2026-07-06T10:00:00"
  },
  "msg": "success"
}
```

#### GET /admin-api/pay/profit-recipient/page

**权限**: `pay:profit-recipient:query`

**Query Params**:
- `pageNo`: Integer，默认 1
- `pageSize`: Integer，默认 10，最大 100
- `recipientType`: Integer，可选，筛选平台/店铺级
- `role`: Integer，可选，筛选角色
- `shopId`: Long，可选，筛选指定店铺
- `status`: Integer，可选
- `recipientName`: String，可选，模糊搜索

**Response**: `PageResult<ProfitRecipientRespVO>`

#### GET /admin-api/pay/profit-recipient/list-by-shop

查询指定店铺可用的分账收款人列表。返回规则：
- 平台级、角色=平台、status=1 的收款人
- 该店铺绑定的店铺级收款人（`shop_id = ?` 且 `status = 1`）

**权限**: `pay:profit-recipient:query`

**Query Params**:
- `shopId`: Long，必填

**Response**: `CommonResult<List<ProfitRecipientRespVO>>`

### 店铺分账绑定

#### PUT /admin-api/store/shop/bind-profit-recipient

绑定/解绑店铺分账收款人。

**权限**: `store:shop:update`

**Request Body**:
```json
{
  "shopId": 1,
  "recipientId": 2,
  "enabled": true
}
```

**字段校验**:
- `shopId`: 必填，存在性校验
- `recipientId`: `enabled=true` 时必填；`enabled=false` 时可为 null
- `enabled`: 必填，boolean

**业务规则**:
- `enabled=true` 时：校验 `recipientId` 有效且 `status=1`；更新 `yshop_store_shop.profit_sharing_recipient_id` 和 `profit_sharing_enabled=1`
- `enabled=false` 时：清空 `profit_sharing_recipient_id`，设置 `profit_sharing_enabled=0`
- 一个店铺只能绑定一个分账收款人

**Response**: `CommonResult<Boolean>`

### 分账订单查询

#### GET /admin-api/pay/profit-sharing-order/page

**权限**: `pay:profit-sharing:query`

**Query Params**:
- `pageNo`: Integer，默认 1
- `pageSize`: Integer，默认 10，最大 100
- `orderId`: String，可选
- `shopId`: Long，可选
- `sharingStatus`: Integer，可选（0=待分账, 1=分账中, 2=分账成功, 3=分账失败, 4=已回退）
- `startTime`: String (ISO 8601)，可选
- `endTime`: String (ISO 8601)，可选

**Response**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "orderId": "202607061000001",
        "shopId": 1,
        "shopName": "测试门店",
        "payPrice": 100.00,
        "commissionAmount": 10.00,
        "shopAmount": 90.00,
        "platformRecipientName": "平台账户",
        "shopRecipientName": "店铺账户",
        "sharingStatus": 2,
        "sharingStatusDesc": "分账成功",
        "fallbackRevenue": 0,
        "adapayConfirmId": "ps_xxx",
        "sharingTime": "2026-07-07T00:05:30",
        "errorMsg": null,
        "createTime": "2026-07-06T10:00:00"
      }
    ],
    "total": 100
  },
  "msg": "success"
}
```

#### GET /admin-api/pay/profit-sharing-order/get

**权限**: `pay:profit-sharing:query`

**Query Params**:
- `id`: Long，必填

**Response**: `CommonResult<ProfitSharingOrderRespVO>`（结构同 page 单条）

#### POST /admin-api/pay/profit-sharing-order/retry

对分账失败（`sharing_status=3`）且未回退（`fallback_revenue=0`）的订单手动重试分账。

**权限**: `pay:profit-sharing:update`

**Request Body**:
```json
{
  "id": 1
}
```

**业务规则**:
- 仅 `sharing_status=3` 且 `fallback_revenue=0` 的订单可重试
- 重试时更新 `sharing_status=1`，调用 Adapay `PaymentConfirm.create`
- 若成功更新为 `2`，失败保持 `3` 并更新 `error_msg`

**Response**: `CommonResult<Boolean>`

## 内部调用合约

### order-biz → pay-api

**接口**: `ProfitSharingOrderApi.createSharingOrder(CreateSharingOrderDTO dto)`

**调用时机**: `AppStoreOrderServiceImpl.paySuccess()` 中，当 `payType=ADAPAY` 且店铺启用分账时。

**DTO**:
```java
public class CreateSharingOrderDTO {
    private String orderId;
    private Long shopId;
    private BigDecimal payPrice;
    private BigDecimal commissionAmount;
    private Long platformRecipientId;
    private Long shopRecipientId;
    private String adapayPaymentId;
    private Long tenantId;
}
```

**约束**:
- `payPrice` 必须等于 `commissionAmount + shopAmount`
- `platformRecipientId` 和 `shopRecipientId` 必须在同一租户下
- 调用方（order-biz）不直接操作 `yshop_adapay_profit_sharing_order` 表

### store-biz → pay-api

**接口**: `ProfitRecipientApi.listByShop(Long shopId)`

**调用时机**: 管理后台查询店铺可选分账收款人时。

**返回**: `List<ProfitRecipientDTO>`（仅包含 `id`, `recipientName`, `recipientType`, `role`）

## 权限矩阵

| 接口 | 所需权限 | 说明 |
|------|----------|------|
| 分账收款人 CRUD | `pay:profit-recipient:*` | 新增权限组，建议分配给财务/超管角色 |
| 分账订单查询 | `pay:profit-sharing:query` | 可查看所有租户分账记录 |
| 分账订单重试 | `pay:profit-sharing:update` | 手动修复失败分账 |
| 店铺绑定收款人 | `store:shop:update` | 复用现有店铺更新权限 |

## 数据权限

- 分账收款人查询：受 `tenant_id` 隔离，超管可跨租户查看
- 分账订单查询：受 `tenant_id` 隔离；若用户有门店范围限制，需额外过滤 `shop_id IN (shopIds)`
- 店铺绑定：仅允许绑定当前租户下的收款人；多门店管理员只能绑定自己管理的店铺

## 错误码

| 错误码 | 含义 | 触发场景 |
|--------|------|----------|
| `PROFIT_RECIPIENT_NOT_EXISTS` (1_xxx_001) | 分账收款人不存在 | 查询/更新/删除时 ID 不存在 |
| `PROFIT_RECIPIENT_BOUND` (1_xxx_002) | 收款人已被绑定 | 删除已被店铺绑定的收款人 |
| `PROFIT_RECIPIENT_TYPE_MISMATCH` (1_xxx_003) | 收款人类型不匹配 | 店铺绑定平台级收款人 |
| `PROFIT_RECIPIENT_SHOP_MISMATCH` (1_xxx_004) | 收款人店铺不匹配 | 绑定其他店铺的收款人 |
| `PROFIT_SHARING_ORDER_NOT_EXISTS` (1_xxx_005) | 分账订单不存在 | 查询/重试时 ID 不存在 |
| `PROFIT_SHARING_STATUS_INVALID` (1_xxx_006) | 分账状态不允许操作 | 非失败状态调用重试 |
| `PROFIT_SHARING_ROLE_RECIPIENT_MISSING` (1_xxx_007) | 某角色有效收款人未配置 | 创建分账记录时租户无该角色有效收款人 |
| `PROFIT_SHARING_SHOP_RECIPIENT_MISSING` (1_xxx_008) | 店铺未绑定收款人 | 支付时店铺启用分账但无绑定收款人 |
| `PROFIT_SHARING_AMOUNT_MISMATCH` (1_xxx_009) | 分账金额校验失败 | 执行分账前 platform + shop != payPrice，或创建记录时金额不一致 |
| `PROFIT_SHARING_PAY_DISABLED` (1_xxx_010) | 分账配置不完整，禁止支付 | 支付时缺少有效收款人 |
| `PROFIT_RECIPIENT_MEMBER_CREATE_FAILED` (1_xxx_011) | Adapay Member 创建失败 | 调用 Adapay 创建 Member 失败 |
| `PROFIT_RECIPIENT_SETTLE_ACCOUNT_FAILED` (1_xxx_012) | Adapay 结算账户绑定失败 | 调用 Adapay 绑定结算账户失败 |

> 注：具体错误码数值由 backend-agent 在实现时按模块错误码段分配。

## 调用顺序

1. **初始化阶段**：超管创建平台角色分账收款人（必须）→ 创建各店铺级分账收款人 → 各店铺绑定收款人
2. **支付阶段**：用户下单 → 选择 Adapay 支付 → 支付成功回调 → 创建分账挂起记录（`sharing_status=0`）
3. **结算阶段**：日终 Job 执行 → 查询待分账订单 → 调用 Adapay `PaymentConfirm.create` → 更新状态
4. **失败回退**：分账失败 → 自动回退到 `RevenueJob` 虚拟余额结算 → 标记 `sharing_status=4` / `fallback_revenue=1`
5. **运维阶段**：管理后台查看分账订单 → 对未回退的失败订单手动重试

## 前端消费

| 接口 | 消费者 |
|------|--------|
| `/admin-api/pay/profit-recipient/*` | `admin/` 管理后台 — 财务/支付配置页面 |
| `/admin-api/store/shop/bind-profit-recipient` | `admin/` 管理后台 — 门店编辑页面（新增分账配置区块） |
| `/admin-api/pay/profit-sharing-order/*` | `admin/` 管理后台 — 分账订单管理页面 |

无 `app-api/` 变更，小程序用户无感知。
