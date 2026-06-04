## 变更概述

为 `miniapp` 新增订单详情页，并将订单列表的单条订单卡片接入详情跳转；同时补充相关治理文档与订单详情契约说明。本次不包含后端代码改动。

## 受影响仓库及文件清单

### workspace root
- `governance/CONTRACTS.md`
- `governance/team-docs/order-detail-page/requirements-spec.md`
- `governance/team-docs/order-detail-page/technical-design.md`
- `governance/team-docs/order-detail-page/ui-ux-design.md`
- `governance/team-docs/order-detail-page/test-plan.md`
- `governance/team-docs/order-detail-page/CHANGE-REPORT.md`

### miniapp
- `miniapp/app.json`
- `miniapp/pages/orders/orders.js`
- `miniapp/pages/orders/orders.wxml`
- `miniapp/pages/refund/refund.js`
- `miniapp/pages/order-detail/order-detail.js`
- `miniapp/pages/order-detail/order-detail.wxml`
- `miniapp/pages/order-detail/order-detail.wxss`
- `miniapp/pages/order-detail/order-detail.json`

## API 变更摘要

- 未新增后端接口
- 复用现有 `GET /app-api/order/detail/{key}`
- 在 `CONTRACTS.md` 中补充订单详情页依赖字段说明与接口用途说明

## 数据库变更

- 无
- 无 migration 脚本

## UI/UX 变更

新增页面：
- `订单详情页`

交互调整：
- 订单列表整卡点击进入详情页
- 订单详情页支持：
  - 查看商品明细
  - 查看金额明细
  - 查看订单信息
  - 查看退款信息
  - 复制订单号
  - 未支付订单继续支付
  - 可退款订单进入退款页

退款链路调整：
- 从订单详情页进入退款页后，提交成功可返回详情页，而不是固定跳回列表页

## 测试覆盖情况

已执行：
- `node --check miniapp/pages/order-detail/order-detail.js`
- `node --check miniapp/pages/orders/orders.js`
- `node --check miniapp/pages/refund/refund.js`
- `(cd miniapp && node test/static-check.js)`

结果：
- 均通过

未执行：
- `npm test`：`miniapp/package.json` 未定义 `test` script
- 微信开发者工具人工联调：未在本流程中执行

## 审查结论

### PASS
- 需求范围与实现一致
- 未引入后端代码改动
- 无数据库变更
- MiniApp 新页面与现有订单/退款流程保持一致
- 契约文档已更新

### 遗留问题
- 订单详情接口权限模型未在本次中调整；这是按用户要求收敛范围后的结果
- 仍建议在微信开发者工具内人工验证以下路径：
  - 订单列表 → 订单详情
  - 订单详情 → 立即支付
  - 订单详情 → 申请退款 → 返回详情

## 风险评估

- 低到中风险
- 主要风险在于接口字段的线上实际返回形态若与当前假设有偏差，会影响部分展示文案或空态处理，但不影响页面结构本身
