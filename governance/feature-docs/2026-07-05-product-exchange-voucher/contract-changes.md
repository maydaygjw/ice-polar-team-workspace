# Contract Changes: 商品兑换券

## 1. Platform Contracts (CONTRACTS.md)

### 1.1 Changed

**Core Entity ID Types — 新增**

| Entity | ID Type | Notes |
|--------|---------|-------|
| Voucher Template | Long | `yshop_product_voucher.id` |
| Voucher Code | Long | `yshop_product_voucher_code.id` |
| Voucher Code (business key) | String (64) | `yshop_product_voucher_code.code` — 用户可见券码 |

**Common Result Structure — 无变更**

复用现有结构：`{ code: 0, data: {}, msg: "success" }`。

### 1.2 Reused as-is

- **Module Dependency Rules** — 跨模块调用通过 `-api` 模块，见 `CONTRACTS.md` § Module Dependency Rules。
- **Admin API Prefix** — `/admin-api/...`，无变更。
- **Multi-Tenant Isolation** — `tenant_id` 自动注入，无变更。
- **Device Architecture Contract** — MiniApp 禁止直接调用 DMS，全部通过 backend Proxy API 转发，无变更。

### 1.3 No contract needed

- **Store Revenue Type Enum** — 兑换券订单不产生实际支付，不写入收入流水；如有需要后续扩展 `type=4`（兑换券核销）。
- **Commission Contract** — 兑换券订单 0 元，无抽成；如有需要后续单独定义。

---

## 2. Feature-Level API Contracts

### 2.1 Admin Endpoints (`/admin-api/voucher/*`)

| 端点 | 变更类型 | 说明 |
|------|---------|------|
| `POST /voucher/template/create` | 新增 | 创建兑换券模板 |
| `PUT /voucher/template/update/{id}` | 新增 | 修改模板（仅 status=0 可改） |
| `GET /voucher/template/page` | 新增 | 分页查询模板 |
| `GET /voucher/template/{id}` | 新增 | 模板详情 |
| `PUT /voucher/template/status/{id}` | 新增 | 启停模板（0↔1） |
| `POST /voucher/code/import` | 新增 | 批量导入券码（multipart/form-data，Excel/CSV） |
| `GET /voucher/code/page` | 新增 | 券码分页列表（支持按 status、batch_no 筛选） |
| `GET /voucher/code/export` | 新增 | 导出券码使用状态（Excel） |
| `PUT /voucher/code/freeze/{id}` | 新增 | 冻结券码 |
| `PUT /voucher/code/unfreeze/{id}` | 新增 | 解冻券码 |

**Admin 权限：** `@PreAuthorize("@ss.hasPermission('voucher:template:manage')")`

### 2.2 C-End Endpoints (`/app-api/voucher/*`)

| 端点 | 变更类型 | 说明 | 权限 |
|------|---------|------|------|
| `POST /voucher/redeem` | 新增 | 核销券码（输入/扫描） | `@PreAuthenticated` |
| `GET /voucher/my` | 新增 | 我的兑换券列表 | `@PreAuthenticated` |
| `GET /voucher/detail/{code}` | 新增 | 券码详情 | `@PreAuthenticated` |
| `POST /voucher/order` | 新增 | 用券创建设备订单 | `@PreAuthenticated` |

### 2.3 Modified Existing Endpoints

| 端点 | 变更 | 说明 |
|------|------|------|
| `POST /app-api/device/_order` | 新增参数 | 新增可选字段 `voucherCodeId?: Long` — 传入则使用兑换券抵扣，跳过支付流程 |
| `GET /app-api/order/detail/{key}` | 新增字段 | 响应中新增 `voucherCode?: string`、`orderSource?: number` |
| `GET /app-api/order/list` | 新增字段 | 响应列表项新增 `orderSource?: number` |

### 2.4 DTO Definitions

#### `VoucherTemplateCreateReqVO`

```java
public class VoucherTemplateCreateReqVO {
    @NotNull private Long productId;      // 兑换商品 ID
    @NotNull private Long shopId;        // 适用门店
    @NotBlank @Size(max=128) private String title;
    @Size(max=16) private String codePrefix;
    @NotNull @Min(1) private Integer totalCount;
    @NotNull @Min(0) private Integer validDays;   // 0=使用固定有效期
    private LocalDateTime startTime;     // validDays=0 时必填
    private LocalDateTime endTime;       // validDays=0 时必填
}
```

#### `VoucherRedeemReqVO`

```java
public class VoucherRedeemReqVO {
    @NotBlank @Size(max=64) private String code;
}
```

#### `VoucherRedeemRespVO`

```java
public class VoucherRedeemRespVO {
    private Long voucherCodeId;
    private String code;
    private String title;
    private Long productId;
    private String productName;
    private String productImage;
    private Long shopId;
    private String shopName;
    private Integer status;        // 0=UNUSED 1=BOUND 2=USED 3=FULFILLED
    private LocalDateTime expireTime;
}
```

#### `VoucherOrderCreateReqVO`

```java
public class VoucherOrderCreateReqVO {
    @NotNull private Long voucherCodeId;
    @NotBlank private String imei;
    @NotNull private Long shopId;
}
```

#### `VoucherOrderCreateRespVO`

```java
public class VoucherOrderCreateRespVO {
    private String orderId;        // yshop_store_order.order_id
    private Long deviceOrderId;    // yshop_device_order.id
}
```

### 2.5 Enum Definitions

#### `VoucherCodeStatusEnum`

| Value | Name | Description |
|-------|------|-------------|
| 0 | `UNUSED` | 未使用（已导入） |
| 1 | `BOUND` | 已绑定（用户已输入券码） |
| 2 | `USED` | 已使用（已创建订单） |
| 3 | `FULFILLED` | 已履约（设备出冰完成） |
| 4 | `EXPIRED` | 已过期 |
| 5 | `FROZEN` | 已冻结 |

#### `VoucherTemplateStatusEnum`

| Value | Name | Description |
|-------|------|-------------|
| 0 | `DISABLED` | 未启用 |
| 1 | `ENABLED` | 启用中 |
| 2 | `ENDED` | 已结束 |

#### `OrderSourceEnum`（扩展）

| Value | Name | Description |
|-------|------|-------------|
| 0 | `NORMAL` | 正常下单 |
| 1 | `VOUCHER` | 兑换券核销 |

---

## 3. Machine-Generated OpenAPI

**新增模块需生成 OpenAPI JSON：**

- `yshop-module-voucher-biz` 启动后，Swagger 自动生成 `/v3/api-docs/voucher`。
- 由 `extract-openapi` skill 收集到 `governance/CONTRACT/backend-api.json`。

**变更影响：**
- `AppDeviceManagementController` — `POST /app-api/device/_order` 参数新增 `voucherCodeId`
- `AppOrderController` — `GET /app-api/order/detail/{key}` 响应新增字段
- `AppOrderController` — `GET /app-api/order/list` 响应新增字段

---

## 4. Admin vs C-End Endpoints

| 维度 | Admin (`/admin-api`) | C-End (`/app-api`) |
|------|---------------------|-------------------|
| **鉴权** | `@PreAuthorize` + 权限字符串 | `@PreAuthenticated` + 登录校验 |
| **租户** | 按登录管理员租户隔离 | 按 JWT `tenant_id` 隔离（冰立得固定 153） |
| **券码操作** | 导入、冻结、导出、查询全部 | 仅 redeem、my、detail、order |
| **模板操作** | CRUD、启停 | 只读（通过 redeem 响应间接查看） |
| **数据范围** | 本租户全部数据 | 仅当前 user_id 关联数据 |

---

## 5. Permission & Tenant Rules

### 5.1 Admin 权限点

| 权限标识 | 说明 |
|----------|------|
| `voucher:template:manage` | 兑换券模板管理（增删改查） |
| `voucher:code:manage` | 券码管理（导入、导出、冻结） |
| `voucher:code:view` | 券码查看（只读） |

### 5.2 Tenant 规则

- 所有 `yshop_product_voucher` / `yshop_product_voucher_code` 查询自动附加 `tenant_id = ?`。
- 冰立得小程序固定 `tenant_id = 153`（由 `TenantLineInnerInterceptor` 注入）。
- Admin 后台按登录管理员所属租户隔离（可管理多租户）。
- 券码 `uk_code_tenant` 联合唯一键确保跨租户券码可重复（不同租户可用相同券码）。

### 5.3 C-End 数据隔离

- `/app-api/voucher/my` — 查询 `user_id = currentUserId AND tenant_id = 153`。
- `/app-api/voucher/redeem` — 查询 `code = ? AND tenant_id = 153`。
- 绑定后 `user_id` 写入券码记录，后续操作校验 `user_id` 一致性。

---

## 6. Contract Version

- **Initial version** — 2026-06-25, created during `product-exchange-voucher` Phase 1 architecture design.
- **Depends on**: `CONTRACTS.md` (platform), `feature-docs/2026-07-24-device-api/contract-changes.md` (device order creation), `feature-docs/2026-06-05-order-detail-page/contract-changes.md` (order detail fields).
