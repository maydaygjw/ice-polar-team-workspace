# Order Refund Reject — Technical Design

## Overview
Add an admin "reject refund" action for `yshop_store_order`. When rejecting, the admin records a reject reason and chooses whether the user may re-apply. If re-apply is allowed, the user can submit a new refund request after rejection.

---

## Database Changes

### `yshop_store_order`

| Column | Type | Default | Comment |
|--------|------|---------|---------|
| `refund_reason` | varchar(255) | `NULL` | Reused as **管理员退款拒绝原因**. Migration drops the historical default `'不喜欢'` and updates the column comment. |
| `refund_reapply` | tinyint(1) | `0` | **拒绝后是否允许再次申请退款** (`0=否 1=是`). |

- Migration: `backend/sql/upgrade-2026-07-05-order-refund-reject.sql`

```sql
ALTER TABLE `yshop_store_order`
    MODIFY COLUMN `refund_reason` VARCHAR(255) NULL COMMENT '退款拒绝原因（管理员填写）',
    ADD COLUMN `refund_reapply` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '拒绝后是否允许再次申请退款：0否 1是' AFTER `refund_reason`;
```

### Enums

| Enum | Change |
|------|--------|
| `OrderInfoEnum` | Add `REFUND_STATUS_3(3, "已拒绝")` |
| `OrderLogEnum` | Add `REFUND_ORDER_REJECT("reject_refund", "管理员拒绝退款")` |

### `yshop_store_order_status`

- No schema change. Rejections are logged with `change_type = 'reject_refund'` and `change_message = '商家拒绝退款，原因：xxx，允许/不允许再次申请'`.

---

## API Design

### Admin API

| Endpoint | Method | Summary | Permission |
|----------|--------|---------|------------|
| `/admin-api/order/store-order/refund` | POST | Confirm refund (existing) | `order:store-order:update` |
| `/admin-api/order/store-order/reject-refund` | POST | Reject refund | `order:store-order:update` |

#### `POST /admin-api/order/store-order/reject-refund`

**Request VO — `StoreOrderRejectRefundVO`**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Long | Yes | Order primary key |
| `rejectReason` | String | Yes | Reason shown to user |
| `allowReapply` | Boolean | No, default `false` | Whether the user can re-apply |

**Response**: `CommonResult<Boolean>`

**Validation**

- Order exists.
- `refundStatus == 1` (refunding). Otherwise reject with `ORDER_STATUS_ERROR`.
- Not already refunded or rejected.

**Side Effects**

- Set `refund_status = 3`, `refund_reason = rejectReason`, `refund_reapply = allowReapply ? 1 : 0`.
- Clear user-submitted refund fields (`refund_reason_wap`, `refund_reason_wap_explain`, `refund_reason_wap_img`) if they were previously set.
- Insert order status log.
- No payment, no stock rollback, no revenue reversal.

### App API

| Endpoint | Method | Change |
|----------|--------|--------|
| `POST /app-api/order/refund` | POST | Allow re-apply when `refundStatus == 3 && refundReapply == 1` |
| `GET /app-api/order/detail/{key}` | GET | Response now includes `refundReason` and `refundReapply` |
| `GET /app-api/order/list` | GET | Response now includes `refundReason` and `refundReapply` |

#### `POST /app-api/order/refund` updated rules

- Block if `refundStatus == 1`, `2`, or `(3 && refundReapply == 0)`.
- Allow if `refundStatus == 0` or `(3 && refundReapply == 1)`.
- On re-apply, set `refundStatus = 1`, update user-submitted reason/image/explain/time, and **clear `refundReason`** (admin reject reason is retained only in `yshop_store_order_status` log).

---

## Module Impact

### Backend

| File | Change |
|------|--------|
| `yshop-framework/yshop-common/.../OrderInfoEnum.java` | Add `REFUND_STATUS_3` |
| `yshop-module-mall/yshop-module-order-api/.../OrderLogEnum.java` | Add `REFUND_ORDER_REJECT` |
| `yshop-module-mall/yshop-module-order-api/.../ErrorCodeConstants.java` | Add `ORDER_REFUND_REJECTED_NOT_REAPPLY`, `ORDER_NOT_REFUNDING` |
| `yshop-module-mall/yshop-module-order-biz/.../dal/dataobject/storeorder/StoreOrderDO.java` | Add `refundReapply` field |
| `yshop-module-mall/yshop-module-order-biz/.../controller/admin/storeorder/vo/StoreOrderBaseVO.java` | Add `refundReapply`; update `refundReason` description |
| `yshop-module-mall/yshop-module-order-biz/.../controller/admin/storeorder/vo/StoreOrderRejectRefundVO.java` | New request VO |
| `yshop-module-mall/yshop-module-order-biz/.../controller/admin/storeorder/StoreOrderController.java` | Add `rejectRefund` endpoint |
| `yshop-module-mall/yshop-module-order-biz/.../service/storeorder/StoreOrderService.java` | Add `orderRejectRefund(...)` |
| `yshop-module-mall/yshop-module-order-biz/.../service/storeorder/StoreOrderServiceImpl.java` | Implement reject; update `handleOrderStatus` for status `3` |
| `yshop-module-mall/yshop-module-order-biz/.../service/storeorder/AppStoreOrderServiceImpl.java` | Update `orderApplyRefund` validation; update `handleOrder` status display |
| `yshop-module-mall/yshop-module-order-biz/.../controller/app/order/vo/AppStoreOrderQueryVo.java` | Add `refundReason`, `refundReapply` |
| `yshop-module-merchant/.../AppOrderServiceImpl.java` | Review queries; treat `refundStatus=3` as non-normal (do not include in normal/refunded counts) |
| `yshop-module-mall/yshop-module-order-biz/.../service/storeorder/AsynStoreOrderServiceImpl.java` | Review queries that assume only `0/1/2` |

### Admin Frontend

| File | Change |
|------|--------|
| `admin/src/api/mall/order/storeOrder/index.ts` | Add `rejectRefundStoreOrder(data)`; add `refundReapply` to `StoreOrderVO` |
| `admin/src/views/mall/order/storeOrder/index.vue` | Add "拒绝退款" button when `statusStr == '退款中'`; pass row to reject dialog |
| `admin/src/views/mall/order/storeOrder/StoreOrderRejectRefund.vue` | New dialog: reject reason input + allow-reapply switch |

### MiniApp

| File | Change |
|------|--------|
| `miniapp/pages/orders/orders.js` | Handle `refundStatus == 3`; show "退款已拒绝"; allow re-apply when `refundReapply == 1` |
| `miniapp/pages/order-detail/order-detail.js` | Same as above; display `refundReason` |
| `miniapp/pages/refund/refund.js` | No API change; re-apply uses same endpoint |

---

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant M as MiniApp
    participant B as Backend
    participant D as MySQL

    U->>M: Submit refund reason
    M->>B: POST /app-api/order/refund
    B->>D: update refund_status=1, log apply_refund
    B-->>M: ok

    rect rgb(240,240,240)
        Note over Admin,A: Admin rejects
        participant A as Admin
        A->>B: POST /admin-api/order/store-order/reject-refund<br/>{rejectReason, allowReapply}
        B->>D: update refund_status=3, refund_reason, refund_reapply
        B->>D: insert reject_refund log
        B-->>A: ok
    end

    alt allowReapply = true
        U->>M: Re-apply refund
        M->>B: POST /app-api/order/refund
        B->>D: update refund_status=1, update user reason fields
        B-->>M: ok
    else allowReapply = false
        M->>U: Show reject reason; block re-apply
    end
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing code assumes `refundStatus` only `0/1/2` | Medium | Audit and update all `REFUND_STATUS_*` comparisons in backend, merchant module, admin, and miniapp. |
| `refund_reason` column has historical default `'不喜欢'` | Low | Migration clears default and updates comment; existing values become historical noise only. |
| Merchant/home statistics may miscount rejected orders | Low | Treat `refundStatus=3` as non-normal in counts; re-test merchant dashboards. |
| Re-apply loop abuse | Low | Business decision: admin controls whether re-apply is allowed per rejection. |
| Order status display strings diverge | Low | Update `handleOrderStatus` (admin) and `handleOrder` (app) to return "退款已拒绝". |
