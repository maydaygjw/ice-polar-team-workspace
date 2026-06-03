# Cross-Repository Contracts

This file defines the contracts between backend (`yshop-drink`) and frontend (`yshop-drink-vue`, `icepolarminiapp`). Any change here requires synchronization across all repos.

> `icepolarminiapp` is a native WeChat Mini Program for the ice-machine business (tenant-id: 153). It shares the same `yshop-drink` backend and reuses the `app-api/` C-end contract.

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

## Device API Contract

> **接口结构以 OpenAPI JSON 快照为准**：
> - Backend Proxy API: [`CONTRACT/backend-api.json`](CONTRACT/backend-api.json)
> - DMS 内部 API: [`CONTRACT/icepolar-dms-api.json`](CONTRACT/icepolar-dms-api.json)
>（由 `extract-openapi` skill 从各子项目自动收集，详见 [`CONTRACT/README.md`](CONTRACT/README.md)）

### 架构原则

**MiniApp 禁止直接调用 DMS。** 所有设备操作必须通过 backend Proxy API 转发：

```
MiniApp ──→ yshop-drink backend ──→ icepolar-dms
```

- MiniApp 仅与 backend `/app-api/device/*` 交互
- Backend 通过 `HttpClientUtils` 调用 DMS（`yshop.device.dms.host`）
- DMS 地址对 MiniApp 不可见

### API 结构

> 路径、参数、响应结构详见 [`CONTRACT/backend-api.json`](CONTRACT/backend-api.json)（由 `extract-openapi` skill 自动生成，与代码同步）。

关键端点：
- `GET /app-api/device/status/{imei}` — 查询设备状态
- `POST /app-api/device/command/{imei}/{commandType}` — 下发设备指令（commandType 1-11，见下方）

**指令类型映射（yinerda DTU 规范）**

| commandType | 指令名称 | DMS 内部路径 |
|-------------|---------|-------------|
| 1 | 水桶门 | `POST /api/v1/commands/{imei}/1` |
| 2 | 杯子门 | `POST /api/v1/commands/{imei}/2` |
| 3 | 开始制冰 | `POST /api/v1/commands/{imei}/3` |
| 4 | 停止制冰 | `POST /api/v1/commands/{imei}/4` |
| 5 | 蒸发器化冰 | `POST /api/v1/commands/{imei}/5` |
| 6 | 冰桶化冰 | `POST /api/v1/commands/{imei}/6` |
| 7 | 出冰 | `POST /api/v1/commands/{imei}/7` |
| 8 | 出杯 | `POST /api/v1/commands/{imei}/8` |
| 9 | 自清洗 | `POST /api/v1/commands/{imei}/9` |
| 10 | 语音 | `POST /api/v1/commands/{imei}/10` |
| 11 | 授时 | `POST /api/v1/commands/{imei}/11` |

### 权限要求

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

### DMS 转发说明

Backend 通过 `HttpClientUtils` 将请求转发至 DMS：

- **状态查询**：`HttpClientUtils.executeHttpGetRequest("/api/v1/devices/{imei}/status")`
- **指令下发**：`HttpClientUtils.executeHttpRequest("/api/v1/commands/{imei}/{commandType}", emptyMap)`
- DMS 基础地址配置项：`yshop.device.dms.host`
- Backend 负责 DMS 响应字段映射、异常包装、操作日志记录

> **接口结构**：详见 [`CONTRACT/backend-api.json`](CONTRACT/backend-api.json)（Backend Proxy API）和 [`CONTRACT/icepolar-dms-api.json`](CONTRACT/icepolar-dms-api.json)（DMS 内部 API），由 `extract-openapi` skill 自动从子项目收集生成。
