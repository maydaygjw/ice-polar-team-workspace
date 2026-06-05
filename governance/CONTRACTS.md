# Cross-Repository Contracts

This file defines the **platform-level contracts** between backend (`yshop-drink`) and frontend (`yshop-drink-vue`, `icepolarminiapp`). Any change here requires synchronization across all repos.

> **Document Layering**: See [Contract Document Layers](#contract-document-layers) below for how this file relates to feature-level and machine-generated contract docs.

## Contract Document Layers

| Layer | File | Purpose | Maintained By |
|-------|------|---------|---------------|
| **Platform** | `CONTRACTS.md` (this file) | Cross-module rules, shared enums, universal response format, security boundaries | Architecture review |
| **Feature** | `governance/feature-docs/{feature}/contract-changes.md` | Per-feature API semantics, DTO changes, calling order, permission rules | architecture-agent per feature |
| **Machine** | `CONTRACT/backend-api.json` | Complete OpenAPI spec — field types, validation rules, paths | `extract-openapi` skill (auto) |

**Rule of thumb**: If the contract is about "how modules talk to each other" or "what every feature must obey", it belongs here. If it's about "what this specific feature's API looks like", it belongs in the feature's `contract-changes.md`. Structural details (types, validations) belong in the OpenAPI JSON.

## Active Business Contract Index

| Domain | Feature Doc | Description |
|--------|-------------|-------------|
| Order Detail | [`feature-docs/order-detail-page/contract-changes.md`](feature-docs/order-detail-page/contract-changes.md) | C-end order detail query API |
| Device Management | [`feature-docs/device-api/contract-changes.md`](feature-docs/device-api/contract-changes.md) | Device status, commands, and order creation |

---

## Module Dependency Rules

### 跨模块调用必须通过 `-api` 模块

**红线**：任何模块禁止直接依赖其他模块的 `-biz` 包。跨模块调用必须遵循以下规则：

```
module-a-biz ──→ module-b-api (接口 + DTO)
                      ↑
              module-b-biz (实现)
```

- **`-api` 模块** 定义 Service 接口和 DTO，供外部模块依赖
- **`-biz` 模块** 提供接口实现，不暴露给外部模块
- 示例：`yshop-module-device-biz` 依赖 `yshop-module-coupon-api`，通过 `CouponApi` 接口调用优惠券服务，而非直接依赖 `yshop-module-coupon-biz` 或 `AppCouponUserService`

### 违规场景

| 错误做法 | 正确做法 |
|---------|---------|
| `device-biz` pom 依赖 `coupon-biz` | `device-biz` pom 依赖 `coupon-api`，注入 `CouponApi` 接口 |
| `device-biz` 直接 import `CouponUserDO` | `device-biz` 使用 `coupon-api` 提供的 `CouponUserDTO` |

## Admin API Prefix

- Backend: `/admin-api/...`
- Frontend base URL: `VITE_BASE_URL` + `VITE_API_URL`

## Core Entity ID Types

| Entity | ID Type | Notes |
|--------|---------|-------|
| User (admin) | Long | `system_users.id` |
| User (C-end) | Long | `yshop_user.id` |
| Tenant | Long | `system_tenant.id` |
| Shop/Store | Long | `yshop_store_shop.id` |
| Product | Long | `yshop_store_product.id` |
| Order | String (32) | `yshop_store_order.order_id` (business ID) |
| Category | Long | `yshop_store_product_category.id` |

## Commission Contract

### Storage

```
yshop_store_shop.commission_rate      decimal(5,2)  NOT NULL DEFAULT 0.00
yshop_store_product_category.commission_rate  decimal(5,2)  NULL
yshop_store_order.commission_amount   decimal(10,2) NOT NULL DEFAULT 0.00
yshop_store_order_cart_info.commission_rate   decimal(5,2)  NOT NULL DEFAULT 0.00
yshop_store_order_cart_info.commission_amount decimal(10,2) NOT NULL DEFAULT 0.00
```

### Priority Rule

```
product commission_rate =
    IF category.commission_rate IS NOT NULL → use category
    ELSE → use shop.commission_rate (default 0.00)
```

### API

```
POST /store/shop/create     Body: { ..., commissionRate: decimal }
PUT  /store/shop/update     Body: { ..., commissionRate: decimal }
POST /product/category/create  Body: { ..., commissionRate?: decimal }
PUT  /product/category/update  Body: { ..., commissionRate?: decimal }
```

Frontend: `commissionRate` input — number, 0-100, precision 2. Optional for category (null = inherit).

## Store Revenue Type Enum

| Value | Meaning |
|-------|---------|
| 1 | Income (收入) |
| 2 | Expense (支出) |
| 3 | Commission deduction (抽成扣减) |

## Common Result Structure

```json
{
  "code": 0,
  "data": {},
  "msg": "success"
}
```

- `code = 0` means success. Non-zero is an error.
- `data` shape varies by endpoint (object, array, or PageResult).

---

## Device Architecture Contract

### 调用边界

**MiniApp 禁止直接调用 DMS。** 所有设备操作必须通过 backend Proxy API 转发：

```
MiniApp ──→ yshop-drink backend ──→ icepolar-dms
```

- MiniApp 仅与 backend `/app-api/device/*` 交互
- Backend 通过 `HttpClientUtils` 调用 DMS（`yshop.device.dms.host`）
- DMS 地址对 MiniApp 不可见

### 权限模式

| 校验项 | 要求 |
|--------|------|
| 登录状态 | `@PreAuthenticated` — 必须携带有效 Bearer Token |
| 设备管理权限 | 方法内调用 `canManage()` 复用 `/canManage` 逻辑：校验用户手机号是否关联 `YWYYG` 岗位编码 |
| 租户隔离 | `tenant-id` 必须为 `153`（由 `TenantLineInnerInterceptor` 自动注入） |

### 错误码

| Code | 含义 | 触发场景 |
|------|------|---------|
| 0 | 成功 | 请求正常处理 |
| 401 | 未授权 | 未登录或 Token 过期/无效 |
| 403 | 禁止访问 | 用户手机号未关联 `YWYYG` 岗位（`canManage()` 校验失败） |
| 404 | 设备不存在 | IMEI 未在系统中注册 |
| 500 | 服务内部错误 | DMS 服务不可用或返回异常 |

### 接口结构

> 完整 API 定义（路径、参数、响应结构）以 OpenAPI JSON 快照为准：
> - Backend Proxy API: [`CONTRACT/backend-api.json`](CONTRACT/backend-api.json)
> - DMS 内部 API: [`CONTRACT/icepolar-dms-api.json`](CONTRACT/icepolar-dms-api.json)
>
> 由 `extract-openapi` skill 从各子项目自动收集，详见 [`CONTRACT/README.md`](CONTRACT/README.md)
>
> 业务语义约定（指令映射、调用顺序、优惠券参数等）见 [`feature-docs/device-api/contract-changes.md`](feature-docs/device-api/contract-changes.md)
