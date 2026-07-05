# MiniApp 实现记录：Order Refund Reject

## 变更文件

- `miniapp/pages/orders/orders.{js,wxml,wxss}`
- `miniapp/pages/order-detail/order-detail.{js,wxml,wxss}`
- `miniapp/pages/refund/refund.{js,wxml,wxss}`

## 核心逻辑

1. `refundStatus === 3` 统一映射为“退款已拒绝”。
2. 重新申请入口仅在 `refundStatus === 3 && refundReapply === 1` 时展示。
3. 拒绝原因仅在 `refundStatus === 3` 时回显，使用 `--brand-error-*` 语义色。
4. 退款页通过 `rejectedReason` 参数展示顶部提示条；表单提交逻辑不变，后端负责覆盖旧数据。

## 关键改动

### 订单列表

- `getRefundStatusText` 增加 `3 -> '退款已拒绝'`。
- `formatOrders` 读取 `refundReapply`/`refundReason`，`canApplyRefund` 扩展为：
  ```js
  rawStatus === 2 && (refundStatus === 0 || (refundStatus === 3 && refundReapply === 1)) && !!refundUni
  ```
- 操作按钮文案根据 `refundStatus === 3` 切换为“重新申请”。
- 新增 `.refund-badge--3` 错误色徽章。

### 订单详情

- `normalizeOrderStatus` 增加 `refundStatus === 3 -> status: 'rejected'`。
- `refundStatusText` 增加“退款已拒绝”。
- 退款信息卡片新增“拒绝原因”行，值使用 `--brand-error-text`。
- 底部操作栏文案根据 `refundStatus === 3` 切换为“重新申请退款”。
- 新增 `.status-card--rejected`、`.status-pill--rejected`、`.refund-tag--rejected`。

### 退款页

- `onLoad` 读取 `rejectedReason` 参数并写入 `data`。
- 顶部新增不可关闭提示条：
  ```
  上次申请已被拒绝：{refundReason}
  ```
- 提交逻辑保持原有 `/app-api/order/refund` 调用，不预填旧用户退款资料。

## 样式

全部复用 `brand-assets/colors/color-palette.wxss` 已有语义变量，未新增色值。

## 验证

- `node --check` 通过三个改动 JS 文件。
- 需在 WeChat DevTools 中真机/模拟器预览（环境无小程序编译 CLI）。
