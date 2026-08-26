# 变更报告 — 后台直接退款

## 概述
订单管理「更多」新增「退款」操作：对已支付且未退款订单一键全额退款，状态置为「已退款」。复用现有 `cancelAndRefund` 端点，不新增接口。

## 影响仓库 / 文件
**backend** (`feat/admin-order-direct-refund`)
- `StoreOrderServiceImpl.java` — `cancelAndRefund` 移除「仅未发货」拦截，适用任意已支付未退款订单
- `StoreOrderService.java` — 接口 javadoc 同步

**admin** (`feat/admin-order-direct-refund`)
- `views/mall/order/storeOrder/index.vue` — 放宽现有「取消并退款」下拉项可见条件（去掉 `statusStr==='未发货'`），单项覆盖所有已支付未退款未删除订单
- `views/mall/order/storeOrder/site.vue` — 服务订单页增加 `paid===1 && refundStatus===0 && isSystemDel===0` 时显示的「退款」按钮，不判断 status
- `api/...index.ts` — 无变更（复用 `cancelAndRefundStoreOrder`）

## API 变更
`POST /order/store-order/cancelAndRefund` 适用范围放宽：未发货 → 已支付未退款任意发货状态。入参/返回/权限不变。详见 `contract-changes.md`。

## DB / UI
- DB：无变更。
- UI：「取消并退款」可见条件 `paid===1 && refundStatus===0 && isSystemDel===0`，不限发货状态；退款中订单仍走独立「确认退款」按钮。

## 校验
- 后端：订单不存在 / 未支付 / 已退款 / 非可退款状态均拦截（复用现有错误码）；普通用户申请退款确认仍要求 `refundStatus==1`。
- 退款链路：复用 `orderRefund`（微信/支付宝/余额 + 退库存 + 流水冲回 + 抽成回滚）。

## 风险
- `cancelAndRefund` 唯一调用方为 admin 控制器，移除发货拦截不影响其他业务；前端「取消并退款」仍仅未发货可见，行为不变。
- 未运行完整 build / ts:check（变更极小且同构，风险低；可按需运行验证）。

## 评审结论
PASS（自评）。等待用户确认后再提交 / 建 PR（遵守 iron rule #4，不自动提交）。
