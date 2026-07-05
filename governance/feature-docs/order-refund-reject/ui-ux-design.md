# 界面风格优化方案: Order Refund Reject

## 现状分析

- **Admin 后台**
  - 订单列表在 `statusStr == '退款中'` 时仅展示「确认退款」按钮，无拒绝入口。
  - 现有 `StoreOrderRefund.vue` 只处理退款金额确认，无拒绝原因采集。
  - `OrderDetail.vue` 未展示退款信息区块，拒绝原因无处可看。

- **Mini-app**
  - 订单列表/详情仅识别 `refundStatus = 1（退款中）` 与 `2（已退款）`，无「已拒绝」状态。
  - 退款申请页为一次性表单，无重新申请指引，用户被拒绝后无明确下一步。

## 优化方案

### 配色

- 全部沿用现有语义色板，不引入新色值。
- **Admin**：使用 Element Plus 语义色，`type="danger"` 作为拒绝/错误态，`type="warning"` 作为退款中，`type="success"` 作为已退款。
- **Mini-app**：
  - 退款中：`--brand-warning-light` / `--brand-warning-text`。
  - 已退款：`--brand-green-100` / `--brand-green-700`。
  - 已拒绝：与现有「已取消」状态徽章一致，使用 `--brand-error-light` / `--brand-error-text`。

### 字体

- **Admin**：沿用 Element Plus 默认字号，弹窗标题 18px，表单标签 14px，错误提示 12px。
- **Mini-app**：沿用现有 token，徽章 `--text-xs`，拒绝原因正文 `--text-sm`，卡片标题 `--text-lg`。

### 组件规范

- **Admin**：`el-button link`、`el-dialog`、`el-form`、`el-input[type=textarea]`、`el-descriptions`、`el-tag`。
- **Mini-app**：原生 `view/text/textarea/button`，延续 `.order-card`、`.detail-card`、`.status-card`、`.refund-badge` 的 BEM 结构与 `rpx` 单位。

### 交互优化

- 拒绝退款为破坏性操作，必须二次确认并强制填写原因。
- 原因输入框实时字数统计，超限/为空时禁用提交。
- Mini-app 被拒绝后保留重新申请入口，并回显上次拒绝原因，降低用户焦虑。

## Admin 后台设计

### 按钮位置/文案

- 在订单列表「操作」列，当 `statusStr == '退款中'` 时：
  - 左侧保留 `el-button link type="primary"`「确认退款」。
  - 右侧新增 `el-button link type="danger"`「拒绝退款」。
  - 若当前列宽 150px 放不下双按钮 +「更多」，将列宽扩至 180px；或在窄屏下将二者合并为 `el-dropdown`「退款处理」，内含「确认退款」「拒绝退款」两项。
- 「更多」下拉菜单中同步增加「拒绝退款」作为兜底入口，文案一致。

### 拒绝退款弹窗布局、字段

- **标题**：拒绝退款
- **表单字段**（label-width 120px）：
  - 订单号：`el-input disabled` 回显。
  - 实付金额：`el-input disabled` 回显。
  - 拒绝原因：`el-input type="textarea"`：
    - placeholder：`请填写拒绝原因，便于用户理解（必填）`
    - `maxlength="255"`
    - 右下角显示 `{{ reason.length }}/255`
    - 校验规则：`required`，长度 1-255 字符。
  - 是否允许再次申请：`el-switch`：
    - 默认关闭。
    - 开启后用户可在小程序端重新发起退款申请；关闭则不允许。
- **底部按钮**：
  - 左：「确 定」，使用 `el-button type="danger"`，提交时显示 loading，校验失败或字数超限则禁用。
  - 右：「取 消」，关闭弹窗并清空表单。

### 订单详情中拒绝原因的展示位置

- 在 `OrderDetail.vue` 的「订单信息」区块之后新增「退款信息」`el-descriptions` 区块。
- 字段：
  - 退款状态：`el-tag`（退款中 warning / 已退款 success / 已拒绝 danger）。
  - 申请时间。
  - 退款原因（用户选择项）。
  - 退款说明（用户补充文本）。
  - 凭证图片（缩略图，可点击预览）。
  - **拒绝原因**：仅当状态为已拒绝时显示，整行使用 `color: var(--el-color-danger)` 或 `el-alert type="error"` 高亮，确保一眼可见。

## Mini-app 设计

### 订单列表/详情中退款状态展示（已拒绝、拒绝原因）

- 扩展 `refundStatus` 枚举：
  - `1`：退款中（warning）
  - `2`：已退款（success）
  - `3`：已拒绝（error）
- 订单列表徽章：
  - 新增 `.refund-badge--3`：背景 `--brand-error-light`，文字 `--brand-error-text`，圆角 999rpx，字号 `--text-xs`。
- 订单详情：
  - 状态映射增加 `status: 'rejected'`，`statusText: '已拒绝'`，`statusDescription: '退款申请未通过，可重新申请或联系客服'。`
  - 新增 `.status-card--rejected`：背景渐变 `#fef2f2 → #ffffff`。
  - 新增 `.status-pill--rejected`：背景 `--brand-error-light`，文字 `--brand-error-text`。
  - 「退款信息」卡片中，当 `refundStatus === 3` 时增加一行「拒绝原因」，值使用 `--brand-error` 或 `--brand-error-text` 着色，左对齐换行显示。

### 被拒绝后重新申请的入口与提示

- **入口位置**：
  - 订单列表卡片底部操作区：当 `refundStatus === 3` 且 `refundReapply === 1` 时，显示 `action-btn action-btn--secondary`「重新申请」。
  - 订单详情底部固定操作栏：当 `refundReapply === 1` 时显示「重新申请退款」次要按钮。
- **逻辑**：
  - 更新 `canApplyRefund` 判定，仅当 `refundStatus === 3 && refundReapply === 1` 时允许再次发起申请。
- **提示**：
  - 进入 `pages/refund/refund` 重新申请时，若来源为已拒绝订单，在页面顶部新增一条不可关闭的提示条：
    - 文案：`上次申请已被拒绝：{refundReason}`
    - 背景：`--brand-error-light`，文字：`--brand-error-text`，圆角 16rpx。
  - 用户可修改退款原因、补充说明和凭证后再次提交。

## 影响范围

- **Admin 前端**
  - `admin/src/views/mall/order/storeOrder/index.vue`：操作列按钮/下拉菜单。
  - `admin/src/views/mall/order/storeOrder/StoreOrderRefund.vue`：复用或克隆为拒绝弹窗组件。
  - `admin/src/views/mall/order/storeOrder/OrderDetail.vue`：新增「退款信息」区块。
- **Mini-app 前端**
  - `miniapp/pages/orders/orders.{js,wxml,wxss}`：退款状态枚举、徽章样式、重新申请按钮。
  - `miniapp/pages/order-detail/order-detail.{js,wxml,wxss}`：状态映射、拒绝原因展示、底部操作栏。
  - `miniapp/pages/refund/refund.{js,wxml}`：重新申请提示条、预填/回显逻辑。
- **后端/API（非 UI，仅协同）**
  - 新增 `refundStatus = 3` 表示已拒绝。
  - 订单详情接口返回拒绝原因字段。
  - 新增管理员「拒绝退款」接口。
- **国际化**：Admin 弹窗标题、Mini-app 提示文案如需多语言需补充 key。
