# Contract Changes: miniapp-ad-carousel

## Summary

本功能复用现有 `yshop_shop_ads` 广告管理模块，扩展 `link` 字段并修复 App API 查询逻辑。不涉及平台级合约变更。

## Changed Contracts

### 1. App API — `GET /app-api/ad/list`

**Status**: Changed

**Endpoint**: `GET /app-api/ad/list?shop_id={shopId}`

**Changes**:
- 响应 `list` 项新增 `link` 字段（string，可为 null）
- 查询逻辑变更：仅返回 `is_switch = 1` 的记录，按 `weigh DESC, id DESC` 排序

**Request** (unchanged):
```
GET /app-api/ad/list?shop_id=8
```

**Response** (envelope unchanged):
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "image": "https://cdn.example.com/ad1.jpg",
        "link": "https://example.com/promo"
      }
    ],
    "isActive": true
  },
  "msg": "success"
}
```

**Backward Compatibility**:
- 此前该端点未被小程序调用，无存量消费者
- 新增 `link` 字段为可选，不影响旧响应结构的理解

### 2. Admin API — `POST /shop/ads/create`, `PUT /shop/ads/update`

**Status**: Changed

**Changes**:
- Create/Update payload 新增可选字段 `link` (string, max 500 chars)

**Request Body**:
```json
{
  "image": "https://cdn.example.com/ad1.jpg",
  "link": "https://example.com/promo",
  "isSwitch": 1,
  "weigh": 10,
  "shopId": "0"
}
```

## Reused Contracts (No Change)

| Contract | Status | Reason |
|----------|--------|--------|
| Admin CRUD endpoints (`GET/DELETE /shop/ads/*`) | Reused as-is | 路径和权限不变，仅 VO 扩展字段 |
| Common Result Structure (`{code, data, msg}`) | Reused as-is | 平台级通用结构 |
| Tenant Isolation (`tenant_id` auto-injected) | Reused as-is | 由 MyBatis Plus 拦截器自动处理 |
| Multi-tenant rules | Reused as-is | 无变更 |

## N/A Contracts

| Contract | Reason |
|----------|--------|
| DMS API | 本功能与设备管理无关 |
| Payment / Order API | 广告展示不涉及支付或订单流程 |
