# Order Refund Reject — Frontend Implementation Notes

## Files Changed

- `admin/src/api/mall/order/storeOrder/index.ts`
  - Added `refundReapply` to `StoreOrderVO`.
  - Added `rejectRefundStoreOrder(data)` → `POST /order/store-order/reject-refund`.

- `admin/src/views/mall/order/storeOrder/index.vue`
  - Added "拒绝退款" button next to "确认退款" when `statusStr == '退款中'`.
  - Added "拒绝退款" entry to the "更多" dropdown.
  - Imported and registered `StoreOrderRejectRefund` component.

- `admin/src/views/mall/order/storeOrder/StoreOrderRejectRefund.vue` (new)
  - Dialog title: 拒绝退款.
  - Fields: orderId (disabled), payPrice (disabled), reject reason textarea (max 255, required, char counter), allow-reapply switch (default off).
  - Confirm button uses `type="danger"`.
  - Emits `success` on completion and closes.

- `admin/src/views/mall/order/storeOrder/OrderDetail.vue`
  - Added "退款信息" `el-descriptions` section for refund orders.
  - Shows refund status tag, apply time, user reason, explanation, voucher image preview, and reject reason (highlighted in danger color when `refundStatus == 3`).

## Status Display

- `statusStr` is rendered directly in the list and detail; backend `handleOrderStatus` returns "退款已拒绝" for `refundStatus == 3`.

## Verification

- `pnpm run build:local` in `admin/` completed successfully.
- `pnpm run ts:check` fails due to pre-existing missing type-definition entries in `tsconfig.json` (`@intlify/unplugin-vue-i18n/types`, `@types/qrcode`, `element-plus/global`, `vite-plugin-svg-icons/client`), unrelated to this change.
