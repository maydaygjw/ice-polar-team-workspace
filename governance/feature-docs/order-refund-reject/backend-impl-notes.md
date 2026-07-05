# Order Refund Reject — Backend Implementation Notes

## Implemented Changes

### Database
- `backend/sql/upgrade-order-refund-reject.sql`
  - `refund_reason` comment updated to "退款拒绝原因（管理员填写）", default dropped.
  - Added `refund_reapply` tinyint(1) NOT NULL DEFAULT 0.

### Enums & Error Codes
- `OrderInfoEnum`: added `REFUND_STATUS_3(3,"已拒绝")`.
- `OrderLogEnum`: added `REFUND_ORDER_REJECT("reject_refund","管理员拒绝退款")`.
- `ErrorCodeConstants`: added `ORDER_REFUND_REJECTED_NOT_REAPPLY` (1008007027) and `ORDER_NOT_REFUNDING` (1008007028).

### DO / VO / DTO
- `StoreOrderDO`: added `refundReapply`.
- `StoreOrderBaseVO`: added `refundReapply`; updated `refundReason` description.
- `StoreOrderRespVO`: inherits new fields from `StoreOrderBaseVO`.
- `AppStoreOrderQueryVo`: added `refundReason` and `refundReapply`.
- New `StoreOrderRejectRefundVO` (fields: `id`, `rejectReason` @NotBlank @Size(max=255), `allowReapply` default false).

### Service
- `StoreOrderService` / `StoreOrderServiceImpl`: added `orderRejectRefund(Long id, String refundReason, Boolean allowReapply)`.
  - Validates order exists and `refundStatus == 1`.
  - Sets `refundStatus = 3`, `refundReason`, `refundReapply`, clears user refund fields.
  - Logs `reject_refund` with message containing reason.
- `StoreOrderServiceImpl.orderRefund`: added precondition `refundStatus == 1`.
- `StoreOrderServiceImpl.handleOrderStatus`: added `refundStatus == 3 -> "退款已拒绝"`.
- `AppStoreOrderServiceImpl.orderApplyRefund`: allows re-apply when `refundStatus == 0` or (`refundStatus == 3 && refundReapply == 1`); clears `refundReason` on re-apply.
- `AppStoreOrderServiceImpl.handleOrder`: added "退款已拒绝" status display.
- `AppOrderServiceImpl.handleOrder` (merchant): added "退款已拒绝" status display.

### Controller
- `StoreOrderController`: added `POST /order/store-order/reject-refund` with permission `order:store-order:update`.

### Audit
- `StoreOrderMapper.selectPage` STATUS_5 (退款单) filter expanded to `refund_status IN (1,2,3)`.
- `AppStoreOrderServiceImpl.orderList` refund filters (type 7 / STATUS_MINUS_3) expanded to include status 3.
- Async/statistics queries that use `REFUND_STATUS_0` remain unchanged; rejected orders correctly excluded from normal paid-order counts.

## Build Status
- `mvn compile -pl yshop-module-mall/yshop-module-order-biz -am -DskipTests` — SUCCESS.
- `mvn compile -pl yshop-module-merchant/yshop-module-merchant-biz -am -DskipTests` — SUCCESS (after cleaning a stale `yshop-spring-boot-starter-redis` class file).

## Notes
- VO field name is `rejectReason` to match contract; service parameter is `refundReason` to match DB column semantics.
- Merchant home "今日退货" count uses `refund_status > 0` and will now include rejected orders as refund-related activity.
