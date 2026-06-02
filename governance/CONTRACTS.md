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

### 架构原则

**MiniApp 禁止直接调用 DMS。** 所有设备操作必须通过 backend Proxy API 转发：

```
MiniApp ──→ yshop-drink backend ──→ icepolar-dms
```

- MiniApp 仅与 backend `/app-api/device/*` 交互
- Backend 通过 `HttpClientUtils` 调用 DMS（`yshop.device.dms.host`）
- DMS 地址对 MiniApp 不可见

### API 定义

#### 1. 查询设备状态

```
GET /app-api/device/status/{imei}
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| imei | Path | String | 是 | 设备 IMEI 号 |
| tenant-id | Header | String | 是 | 租户 ID，固定 `153` |
| Authorization | Header | String | 是 | Bearer Token |

**响应 DTO：`CommonResult<DeviceStatusRespVO>`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `imei` | String | 设备 IMEI 号 |
| `online` | Boolean | 在线状态（`conn_status = 1` → `true`） |
| `iceProgress` | Integer | 制冰进度 0-100 |
| `lastHeartbeat` | String | 最后心跳时间，格式 `YYYY-MM-DD HH:mm:ss` |
| `states` | Array | 设备状态列表 |
| `states[].key` | String | 状态键：`making` / `lackIce` / `lackWater` / `meltIce` / `error` |
| `states[].label` | String | 状态标签：制冰状态 / 缺冰状态 / 缺水状态 / 化冰状态 / 故障状态 |
| `states[].value` | String | 状态显示值 |
| `states[].active` | Boolean | 是否激活（`1` → `true`） |

**DMS → Backend 字段映射**

| DMS 字段 | Backend 字段 | 说明 |
|----------|-------------|------|
| `conn_status` | `online` | `1` → `true`, `0` → `false` |
| `make_ice_status` | `states[0].active` | `1` → 制冰中 |
| `lack_ice_status` | `states[1].active` | `1` → 缺冰 |
| `lack_water_status` | `states[2].active` | `1` → 缺水 |
| `melt_ice_status` | `states[3].active` | `1` → 化冰中 |
| `error_code` | `states[4].value` | `0`→正常, `1`→故障, `2`→杯少 |
| `ice_progress` | `iceProgress` | 0-100 |
| `last_heartbeat` | `lastHeartbeat` | 格式化为 `YYYY-MM-DD HH:mm:ss` |

**DMS 内部路径**：`GET /api/v1/devices/{imei}/status`

#### 2. 下发设备指令

```
POST /app-api/device/command/{imei}/{commandType}
```

**请求参数**

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| imei | Path | String | 是 | 设备 IMEI 号 |
| commandType | Path | Integer | 是 | 指令类型（1-11） |
| tenant-id | Header | String | 是 | 租户 ID，固定 `153` |
| Authorization | Header | String | 是 | Bearer Token |

**响应 DTO：`CommonResult<DeviceCommandRespVO>`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | Boolean | 指令是否成功下发 |
| `message` | String | 下发结果描述 |

**指令类型映射表（yinerda DTU 规范）**

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
| 岗位权限 | 用户必须拥有 `YWYYG`（设备运维员）岗位编码 |
| 租户隔离 | `tenant-id` 必须为 `153`（由 `TenantLineInnerInterceptor` 自动注入） |

### 错误码

| Code | 含义 | 触发场景 |
|------|------|---------|
| 0 | 成功 | 请求正常处理 |
| 401 | 未授权 | 未登录或 Token 过期/无效 |
| 403 | 禁止访问 | 用户无 `YWYYG` 岗位权限 |
| 404 | 设备不存在 | IMEI 未在系统中注册 |
| 500 | 服务内部错误 | DMS 服务不可用或返回异常 |

### DMS 转发说明

Backend 通过 `HttpClientUtils` 将请求转发至 DMS：

- **状态查询**：`HttpClientUtils.executeHttpGetRequest("/api/v1/devices/{imei}/status")`
- **指令下发**：`HttpClientUtils.executeHttpRequest("/api/v1/commands/{imei}/{commandType}", emptyMap)`
- DMS 基础地址配置项：`yshop.device.dms.host`
- Backend 负责 DMS 响应字段映射、异常包装、操作日志记录
