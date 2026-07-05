# Order Refund Reject — Contract Changes

## Admin API

### `POST /admin-api/order/store-order/reject-refund`

Reject a refund application and optionally allow the user to re-apply.

- **Permission**: `@ss.hasPermission('order:store-order:update')`
- **Precondition**: Order `refundStatus` must be `1` (refunding).
- **Idempotent**: No. Calling twice on the same order returns `ORDER_STATUS_ERROR`.

#### Request — `StoreOrderRejectRefundVO`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | Long | Yes | Order primary key (`yshop_store_order.id`) |
| `rejectReason` | String | Yes | Reason shown to the user (≤ 255 chars) |
| `allowReapply` | Boolean | No, default `false` | `true` = user may submit another refund request |

#### Response

```json
{
  "code": 0,
  "data": true,
  "msg": "success"
}
```

### `POST /admin-api/order/store-order/refund` (existing)

Confirm refund. No contract change.

---

## App API

### `POST /app-api/order/refund`

Apply for refund. Validation updated:

- Allowed when `refundStatus == 0`.
- Allowed when `refundStatus == 3` **and** `refundReapply == 1`.
- Blocked otherwise with error code `ORDER_REFUND_REJECTED_NOT_REAPPLY` or `ORDER_REFUNDING` / `ORDER_REFUNDED`.

Request body remains `AppRefundParam`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uni` | String | Yes | Order unique key (`unique` / `orderId` / `extendOrderId`) |
| `text` | String | Yes | Refund reason selected by user |
| `refundReasonWapExplain` | String | No | Detailed explanation |
| `refundReasonWapImg` | String | No | Image URL |

### `GET /app-api/order/detail/{key}`

Response (`AppStoreOrderQueryVo`) adds:

| Field | Type | Description |
|-------|------|-------------|
| `refundReason` | String | Admin reject reason. Meaningful only when `refundStatus == 3`. |
| `refundReapply` | Integer | `0` = cannot re-apply, `1` = can re-apply. |

### `GET /app-api/order/list`

Same two fields are now returned on each order item.

---

## Shared Enum

### `OrderInfoEnum` refund status

| Value | Meaning | Visible copy |
|-------|---------|--------------|
| `0` | 正常 | — |
| `1` | 退款中 | 退款中 |
| `2` | 已退款 | 已退款 |
| `3` | 已拒绝 | 退款已拒绝 |

---

## Calling Order

1. User calls `POST /app-api/order/refund`.
2. Backend sets `refundStatus = 1`.
3. Admin calls either:
   - `POST /admin-api/order/store-order/refund` → `refundStatus = 2`.
   - `POST /admin-api/order/store-order/reject-refund` → `refundStatus = 3` + `refundReason` + `refundReapply`.
4. If rejected with `refundReapply = 1`, user may call `POST /app-api/order/refund` again (goes back to step 2).
