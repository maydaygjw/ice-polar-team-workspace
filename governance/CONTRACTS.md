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
