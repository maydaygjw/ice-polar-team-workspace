# CHANGE-REPORT — Order Refund Reject

## Overview

为门店订单新增管理员“拒绝退款”能力。拒绝时管理员填写拒绝原因，并可选择是否允许用户再次申请；被拒绝订单进入新的 `refundStatus = 3` 状态，并可在管理后台“退款单”筛选中检索。若允许再次申请，用户可在小程序端重新提交退款申请。

## Affected Files

### Workspace root (governance/docs)

- `governance/feature-docs/order-refund-reject/requirements-spec.md`
- `governance/feature-docs/order-refund-reject/technical-design.md`
- `governance/feature-docs/order-refund-reject/contract-changes.md`
- `governance/feature-docs/order-refund-reject/ui-ux-design.md`
- `governance/feature-docs/order-refund-reject/backend-impl-notes.md`
- `governance/feature-docs/order-refund-reject/frontend-impl-notes.md`
- `governance/feature-docs/order-refund-reject/miniapp-impl-notes.md`
- `governance/feature-docs/order-refund-reject/test-notes.md`
- `governance/feature-docs/order-refund-reject/review-report.md`
- `governance/feature-docs/order-refund-reject/CHANGE-REPORT.md`

### Backend (`backend/`)

- `yshop-framework/yshop-common/src/main/java/co/yixiang/yshop/framework/common/enums/OrderInfoEnum.java`
- `yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/ErrorCodeConstants.java`
- `yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/OrderLogEnum.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/controller/admin/storeorder/StoreOrderController.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/controller/admin/storeorder/vo/StoreOrderBaseVO.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/controller/admin/storeorder/vo/StoreOrderRejectRefundVO.java` (new)
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/controller/app/order/vo/AppStoreOrderQueryVo.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/dal/dataobject/storeorder/StoreOrderDO.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/dal/mysql/storeorder/StoreOrderMapper.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderService.java`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderServiceImpl.java`
- `yshop-module-merchant/yshop-module-merchant-biz/src/main/java/co/yixiang/yshop/module/merchant/service/order/AppOrderServiceImpl.java`
- `sql/upgrade-order-refund-reject.sql` (new)

### Admin Frontend (`admin/`)

- `src/api/mall/order/storeOrder/index.ts`
- `src/views/mall/order/storeOrder/index.vue`
- `src/views/mall/order/storeOrder/OrderDetail.vue`
- `src/views/mall/order/storeOrder/StoreOrderRejectRefund.vue` (new)
- `e2e/order-refund-reject.spec.ts` (new)

### MiniApp (`miniapp/`)

- `pages/orders/orders.js`
- `pages/orders/orders.wxml`
- `pages/orders/orders.wxss`
- `pages/order-detail/order-detail.js`
- `pages/order-detail/order-detail.wxml`
- `pages/order-detail/order-detail.wxss`
- `pages/refund/refund.js`
- `pages/refund/refund.wxml`
- `pages/refund/refund.wxss`

## API Changes

### New Admin Endpoint

```
POST /admin-api/order/store-order/reject-refund
Permission: order:store-order:update
Body: { id: Long, rejectReason: String (1-255), allowReapply: Boolean }
Response: CommonResult<Boolean>
```

### Updated Admin Endpoint

```
POST /admin-api/order/store-order/refund
- 新增前置校验：仅当 refundStatus == 1 时可确认退款；已拒绝/已退款订单均返回 ORDER_STATUS_ERROR。
```

### Updated App Endpoints

```
POST /app-api/order/refund
- 允许申请条件：refundStatus == 0，或 (refundStatus == 3 且 refundReapply == 1)。
- 禁止：refundStatus == 1 返回 ORDER_REFUNDING；refundStatus == 2 返回 ORDER_REFUNDED；refundStatus == 3 且 refundReapply == 0 返回 ORDER_REFUND_REJECTED_NOT_REAPPLY。
- 重新申请时覆盖用户退款资料并清空管理员旧拒绝原因。

GET /app-api/order/detail/{key}
GET /app-api/order/list
- Response 新增 refundReason、refundReapply 字段。
```

### Shared Enum Changes

- `OrderInfoEnum.REFUND_STATUS_3` = `3`（已拒绝）
- `OrderLogEnum.REFUND_ORDER_REJECT` = `reject_refund`（管理员拒绝退款）

## Database Changes

```sql
ALTER TABLE `yshop_store_order`
    MODIFY COLUMN `refund_reason` VARCHAR(255) NULL COMMENT '退款拒绝原因（管理员填写）',
    ADD COLUMN `refund_reapply` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '拒绝后是否允许再次申请退款：0否 1是' AFTER `refund_reason`;
```

## UI Changes

### Admin

- 订单列表：退款中订单行新增“拒绝退款”按钮，与“确认退款”并列；“更多”下拉菜单同步增加“拒绝退款”入口。
- 新增“拒绝退款”弹窗：回显订单号/实付金额，拒绝原因多行输入（1-255 字符，实时计数），是否允许再次申请开关。
- 订单详情：新增“退款信息”区块，展示退款状态标签、申请时间、用户退款原因/说明/凭证、拒绝原因（高亮）。

### MiniApp

- 订单列表/详情：新增“退款已拒绝”状态徽章与状态卡片，使用错误色语义变量。
- 订单详情退款信息卡：展示拒绝原因。
- 重新申请入口：仅在 `refundStatus === 3 && refundReapply === 1` 时显示，按钮文案切换为“重新申请”。
- 退款申请页：从已拒绝订单进入时，顶部显示“上次申请已被拒绝：{refundReason}”提示条。

## Test Coverage

- Admin Playwright E2E（`admin/e2e/order-refund-reject.spec.ts`）：
  - 用户申请 → 管理员拒绝（允许再申请）→ 用户重新申请 → 管理员确认退款。
  - 用户申请 → 管理员拒绝（不允许再申请）→ 用户无法重新申请。
  - 非退款中订单拒绝失败。
  - 已拒绝订单直接确认退款失败。
  - 拒绝原因空值/超长校验。
  - 已拒绝订单出现在“退款单”筛选中，且操作日志包含拒绝原因。
- MiniApp E2E 测试计划：状态展示、拒绝原因回显、重新申请入口、后端允许/不允许校验。

## Review Conclusion

**PASS** — 功能实现完整，契约匹配，未发现阻塞性缺陷。

评审报告：`governance/feature-docs/order-refund-reject/review-report.md`

## Risks

- ✅ 商家首页“今日退货”统计已改为 `refund_status IN (1, 2)`，不再把已拒绝订单计入退货数。
- ✅ 新增错误码 `ORDER_NOT_REFUNDING` 已在确认退款非退款中状态时使用。
- ✅ Admin 订单列表操作列宽度已扩至 180px。
- ✅ 拒绝日志已记录是否允许再次申请。
- 待确认：MiniApp 退款入口仍限制 `status === 2`，如设备订单完成后（`status === 3`）需允许退款/重新申请，需后续迭代放宽。
- MiniApp 最终 UI 需在 WeChat DevTools 中真机/模拟器预览验证。
