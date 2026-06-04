# Change Report: 订单详情页

## 变更概述
在冰立得微信小程序的订单列表页增加订单卡片点击跳转功能，并新增独立的订单详情页面，展示完整订单信息。

## 受影响仓库及文件

| 仓库 | 文件 | 变更类型 |
|------|------|----------|
| miniapp (子模块) | `pages/order-detail/order-detail.js` | 新增 |
| miniapp (子模块) | `pages/order-detail/order-detail.wxml` | 新增 |
| miniapp (子模块) | `pages/order-detail/order-detail.wxss` | 新增 |
| miniapp (子模块) | `pages/order-detail/order-detail.json` | 新增 |
| miniapp (子模块) | `pages/orders/orders.js` | 修改 — 增加 `goToDetail` 跳转方法 |
| miniapp (子模块) | `pages/orders/orders.wxml` | 修改 — 卡片增加 `bindtap` 和 `data-order-id` |
| miniapp (子模块) | `app.json` | 修改 — 注册新页面 |
| governance | `team-docs/order-detail/ui-ux-design.md` | 新增 — 设计规范 |

## API 变更摘要

| API | 方法 | 状态 |
|-----|------|------|
| `GET /app-api/order/detail/{orderId}` | 已存在 | 复用，无变更 |

无 CONTRACTS.md 变更 — 仅复用现有 API。

## 数据库变更

无 — 仅前端页面，无 schema 变更。

## UI/UX 变更

| 组件 | 说明 |
|------|------|
| 订单详情页 | 新增 5 个区块：状态头、商品列表、价格明细、订单元数据、底部操作栏 |
| 状态徽章 | 4 种状态色（pending/processing/completed/cancelled）|
| 骨架屏 | shimmer 动画加载态 |
| 错误状态 | 网络错误 + 订单不存在两种态 |
| 操作按钮 | 上下文敏感：待支付显示「立即支付」+「取消订单」，已完成显示「申请退款」|

## 测试覆盖情况

- 未添加自动化测试（微信小程序 E2E 测试框架未接入）
- 需手动验证：列表页点击跳转、详情页数据展示、下拉刷新、各状态操作按钮显示逻辑

## 审查结论

**PASS**（轻微遗留项）

| 检查项 | 结果 | 备注 |
|--------|------|------|
| 实现匹配需求 | ✅ | — |
| API 合同 | ✅ | 复用现有 API，无变更 |
| 无 hardcoded secrets | ✅ | — |
| 分支命名 | ✅ | `feat/order-detail` |
| BEM 命名 | ✅ | — |
| rpx 单位 | ✅ | — |
| CSS 变量 | ✅ | 使用品牌色板 |
| 视觉一致性 | ✅ | — |
| 代码重复 | ✅ | 无冗余 |
| 安全问题 | ✅ | 无注入风险 |

**遗留项**: 取消订单 API 尚未接入（当前为 TODO 占位，仅弹出 toast）。

## 风险评估

| 风险 | 级别 | 说明 |
|------|------|------|
| 取消订单功能不可用 | 低 | 当前为 TODO，不影响主流程 |
| 子模块指针同步 | 低 | 主仓库 feat/order-detail 分支已更新子模块指针 |

---

**等待用户确认以继续进入 Phase 5（Push + PR 创建）**
