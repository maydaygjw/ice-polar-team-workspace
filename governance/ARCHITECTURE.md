# System Architecture

## Repository Layout

```
ice-polar-team-workspace/
├── governance/          ← AI team knowledge center (this repo)
├── backend/             ← Java Spring Boot backend (yshop-drink)
│   ├── yshop-server/    ← Application entrypoint
│   ├── yshop-module-*/  ← Business modules
│   └── sql/             ← Database schemas
├── admin/               ← Vue3 + Vite admin dashboard (yshop-drink-vue)
│   ├── src/views/       ← Admin pages
│   └── src/api/         ← API client definitions
├── miniapp/             ← Native WeChat Mini Program (ice machine)
│   └── pages/           ← Mini-program pages (WXML/WXSS/JS)
└── icepolar-dms/        ← Device Management System (Python/FastAPI)
    └── (hardware-level device command service)
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
    ├── device   ← hardware device binding (calls icepolar-dms)
    ├── mp       ← WeChat official account
    └── message  ← SMS, email, template message
```

## External Systems

| System | Repository | Responsibility | Access Pattern |
|--------|-----------|----------------|----------------|
| `icepolar-dms` | `git@github.com:holun-yshop/icepolar-dms.git` | Hardware device management — connect, dispense ice, deice, self-clean, status query | Called by `yshop-drink` backend (`yshop-module-device-biz`), never by frontend directly |

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
