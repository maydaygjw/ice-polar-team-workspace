# 后台直接退款 — 技术设计

## 影响模块
- `backend/` (`yshop-module-order-biz`)：复用现有 `cancelAndRefund` 端点，仅移除其发货状态拦截。
- `admin/`：复用 `cancelAndRefundStoreOrder` API + 订单列表「更多」入口与服务订单页「退款」按钮。
- 无新增端点、无 DB 变更、无迁移脚本、无新权限点。

## 后端
不新增接口。复用 `StoreOrderServiceImpl.cancelAndRefund(id)`，**移除发货状态拦截**（删去 `if (status != 0) throw "订单已发货或已完成"`），使其适用于已支付未退款的任意发货状态：
- 保留校验：订单存在；`paid==1`（否则 `ORDER_STATUS_ERROR`）；`refundStatus!=2`（否则 `ORDER_REFUNDED`）。
- 调用退款公共逻辑对 `refundStatus==0/1` 的管理员主动退款执行全额退款（复用现有微信/支付宝/余额链路 + 退库存 + 流水冲回 + 抽成回滚）；普通 `orderRefund` 仍要求 `refundStatus==1`。
- 设 `status = OrderInfoEnum.STATUS_NE2 (-2)`，写流水 `OrderLogEnum.REFUND_ORDER_SUCCESS`。

安全性：`cancelAndRefund` 唯一调用方为 admin 控制器；前端「取消并退款」入口仍只在未发货显示，移除拦截不改变其既有行为。错误码全部复用，无新增。

## 前端
- `api/mall/order/storeOrder/index.ts`：复用现有 `cancelAndRefundStoreOrder(id)`，无新增 API。
- `views/mall/order/storeOrder/index.vue`：放宽现有「取消并退款」下拉项的可见条件（去掉 `statusStr==='未发货'`），合并为单项：
  `<el-dropdown-item v-if="scope.row.paid === 1 && scope.row.refundStatus === 0 && scope.row.isSystemDel === 0" @click="handleCancelAndRefund(scope.row)">取消并退款</el-dropdown-item>`
- `views/mall/order/storeOrder/site.vue`：增加「退款」按钮，可见条件为 `paid==1 && refundStatus==0 && isSystemDel==0`，不判断订单 `status`。
- 复用现有 `handleCancelAndRefund`，不新增处理函数。退款中订单仍由独立「确认退款」按钮处理。

## 契约层状态
| 层 | 状态 |
|----|------|
| 平台级 `CONTRACTS.md` | N/A — 非跨端平台契约 |
| 功能级 API | 变更（行为放宽，非新增）→ 见 `contract-changes.md` |
| DB schema | N/A — 复用 `status`/`refund_status`/`refund_price` |
| 事件/MQ | N/A |
| ADR | N/A — 无新架构模式 |
