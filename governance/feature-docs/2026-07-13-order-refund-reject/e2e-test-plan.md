# Order Refund Reject — E2E Test Plan

## 范围

覆盖小程序 ↔ 后端 ↔ 数据库的跨系统退款拒绝及重新申请流程。

## 现有测试能力

- `miniapp/test/smoke.test.js`：仅做页面白屏扫描，不调用业务接口。
- 小程序无后端集成的自动化 E2E 框架，需借助微信开发者工具自动化或手工完成以下场景。

## 测试场景

### 1. 订单列表 — 已拒绝状态展示

- 预置订单：`paid=1`, `status=2`, `refundStatus=3`, `refundReapply=1`, `refundReason='凭证不清晰'`。
- 进入 `pages/orders/orders`。
- 断言：对应订单卡片显示红色「退款已拒绝」徽章。
- 断言：`canApplyRefund` 为真时，卡片底部出现「重新申请」按钮。

### 2. 订单详情 — 拒绝原因与重新申请入口

- 从列表点击已拒绝订单进入 `pages/order-detail/order-detail`。
- 断言：状态区显示「已拒绝」及说明文案。
- 断言：退款信息卡片中展示「拒绝原因：凭证不清晰」。
- 断言：`refundReapply=1` 时底部显示「重新申请退款」按钮；`refundReapply=0` 时不显示。

### 3. 重新申请退款 — 允许再次申请

- 在已拒绝且 `refundReapply=1` 的订单详情点击「重新申请退款」。
- 进入 `pages/refund/refund`，断言顶部提示条回显上次拒绝原因。
- 修改退款原因、补充说明，提交。
- 断言：提交成功 toast「退款申请已提交」。
- 数据库校验：对应订单 `refund_status=1`，`refund_reason` 被清空。

### 4. 重新申请退款 — 不允许再次申请

- 预置订单：`refundStatus=3`, `refundReapply=0`。
- 进入订单详情。
- 断言：无「重新申请退款」按钮。
- 直接调用 `POST /app-api/order/refund` 提交。
- 断言：接口返回错误码 `ORDER_REFUND_REJECTED_NOT_REAPPLY`，`refund_status` 仍为 3。

### 5. 已退款订单禁止再次申请

- 预置订单：`refundStatus=2`。
- 调用 `POST /app-api/order/refund`。
- 断言：接口返回错误码 `ORDER_REFUNDED`，状态保持 2。

### 6. 退款中订单禁止重复申请

- 预置订单：`refundStatus=1`。
- 调用 `POST /app-api/order/refund`。
- 断言：接口返回错误码 `ORDER_REFUNDING`。

## 执行方式

- 手工：使用测试账号登录小程序，按预置数据逐项验证。
- 自动化：基于 `miniprogram-automator` 扩展，增加 mock 登录与接口断言；当前目录下无此能力，需额外搭建。

## 数据准备

- 使用 admin 接口创建测试订单并写入 `refundStatus`/`refundReapply`。
- 或直接在 `yshop_store_order` 更新对应字段。
- 测试完成后清理订单及 `yshop_store_order_status` 日志。
