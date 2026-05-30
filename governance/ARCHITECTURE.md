# System Architecture

## Repository Layout

```
yshop-team/
├── governance/          ← AI team knowledge center (this repo)
├── yshop-drink/         ← Java Spring Boot backend
│   ├── yshop-server/    ← Application entrypoint
│   ├── yshop-module-*/  ← Business modules
│   └── sql/             ← Database schemas
├── yshop-drink-vue/     ← Vue3 + Uniapp frontend
│   ├── src/views/       ← Admin pages
│   └── src/pages/       ← Uniapp mini-program pages
└── icepolarminiapp/     ← Native WeChat Mini Program (ice machine)
    └── pages/           ← Mini-program pages (WXML/WXSS/JS)
```

## Module Dependency Graph

```
yshop-server (aggregator)
    ├── system   ← user, role, permission, tenant, OAuth2
    ├── infra    ← file, job, codegen, config
    ├── member   ← C-end user, address, bill
    ├── store    ← shop info, revenue, withdrawal
    ├── product  ← SPU/SKU, category, brand
    ├── order    ← order lifecycle, cart, status
    ├── pay      ← WeChat Pay, Alipay
    ├── coupon   ← coupon lifecycle
    ├── score    ← points mall
    ├── desk     ← table management, QR code
    ├── device   ← hardware device binding
    ├── mp       ← WeChat official account
    └── message  ← SMS, email, template message
```

## Order State Machine

The order status uses **three fields together** to express state:

| paid | refund_status | status | Meaning |
|:----:|:-------------:|:------:|---------|
| 0 | 0 | 0 | Unpaid |
| 1 | 0 | 0 | Preparing / Pending shipment |
| 1 | 0 | 1 | Delivering / Pending pickup |
| 1 | 0 | 2 | Received / Pending review |
| 1 | 0 | 3 | Completed |
| - | 1 | - | Refunding |
| - | 2 | - | Refunded |

> ⚠️ Known inconsistency: `OrderStatusEnum` and `OrderInfoEnum` define `status` differently. Always check `AppStoreOrderServiceImpl` and `StoreOrderMapper` for ground truth.

## Data Flow — Payment Success

```
WeChat Pay Callback
    ↓
AppStoreOrderServiceImpl.paySuccess()
    ├── Update order status (paid=1, status=0)
    ├── Deduct stock, increment sales
    ├── Calculate commission (category > shop)
    ├── Write store revenue (type=1 income, type=3 commission)
    ├── Send MQ / WebSocket notification
    └── Send WeChat template message
```

## Multi-Tenant Isolation

- Every business table has `tenant_id` (bigint).
- MyBatis Plus `TenantLineInnerInterceptor` automatically appends `tenant_id = ?` to queries.
- `TenantContextHolder` stores current tenant ID from JWT token.
- `@TenantIgnore` bypasses tenant isolation for cross-tenant operations.
