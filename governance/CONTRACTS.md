# Cross-Repository Contracts

This file defines the contracts between backend (`yshop-drink`) and frontend (`yshop-drink-vue`, `icepolarminiapp`). Any change here requires synchronization across all repos.

> `icepolarminiapp` is a native WeChat Mini Program for the ice-machine business (tenant-id: 153). It shares the same `yshop-drink` backend and reuses the `app-api/` C-end contract.

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

## Order Detail Contract

### API

- `GET /app-api/order/detail/{key}` — 查询订单详情

`key` 可为以下任一值：
- `orderId`
- `unique`
- `extendOrderId`

### Response

响应主体为 `AppStoreOrderQueryVo`，MiniApp 订单详情页依赖以下字段：

| 字段 | 说明 |
|------|------|
| `orderId` | 订单号 |
| `unique` | 订单唯一标识，支付/退款等操作复用 |
| `statusDto` | 订单展示状态 |
| `cartInfo` | 商品明细列表 |
| `shopName` | 门店名称 |
| `payType` | 支付方式 |
| `totalPrice` | 商品总价 |
| `payPrice` | 实付金额 |
| `couponPrice` | 优惠券抵扣金额 |
| `deductionPrice` | 会员等优惠抵扣金额 |
| `boxFeePrice` | 餐盒费 |
| `createTime` | 下单时间 |
| `payTime` | 支付时间 |
| `refundStatus` | 退款状态 |
| `refundReasonWapExplain` | 退款说明 |
| `refundReasonWapImg` | 退款凭证图片 |
| `mark` | 用户备注 |
| `remark` | 商家备注 |

### Permission Rule

- 必须登录访问（`@PreAuthenticated`）

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
- `POST /app-api/device/_order` — 创建设备订单（支持优惠券）

**设备订单创建参数**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imei` | String | 是 | 设备 IMEI |
| `productId` | Long | 是 | 商品 ID |
| `shopId` | Long | 否 | 店铺 ID（不传则自动从商品获取） |
| `boxFeeSelected` | Integer | 否 | 是否选择餐盒费；0=不选 1=选 |
| `couponId` | Long | 否 | 用户优惠券 ID（`yshop_coupon_user.id`） |

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
