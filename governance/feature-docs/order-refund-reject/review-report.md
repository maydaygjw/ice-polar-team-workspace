# Order Refund Reject — Review Report

## Review Summary

本次评审覆盖 `backend/`、`admin/`、`miniapp/` 三个子仓库 `feat/order-refund-reject` 分支相对于各自 base 分支的改动，依据 `governance/feature-docs/order-refund-reject/` 下的需求、设计、契约与测试文档进行。

整体实现与需求/契约一致：后端新增 `refundStatus = 3` 状态、`refund_reapply` 字段、拒绝退款接口、确认退款前置校验、用户重新申请校验；Admin 增加拒绝退款按钮/弹窗/详情退款信息；小程序增加已拒绝状态展示、拒绝原因回显与重新申请入口；数据库迁移脚本与 E2E 测试已补齐。

评审结论：**PASS**（附带低优先级改进项，不构成发布阻塞）。

---

## Findings

### 1. 商家首页“今日退货”统计将已拒绝订单计入退货 ✅ Fixed

- **Severity**: Low
- **File**: `backend/yshop-module-merchant/yshop-module-merchant-biz/src/main/java/co/yixiang/yshop/module/merchant/service/home/AppHomeServiceImpl.java:84-91`
- **Description**: `wrapperTwo.gt(StoreOrderDO::getRefundStatus, 0)` 会把 `refundStatus = 3` 的已拒绝订单也计入“今日退货”。
- **Fix applied**: 已改为 `.in(StoreOrderDO::getRefundStatus, OrderInfoEnum.REFUND_STATUS_1.getValue(), OrderInfoEnum.REFUND_STATUS_2.getValue())`，仅退款中与已退款计入退货统计。

### 2. 新增错误码 `ORDER_NOT_REFUNDING` 未使用 ✅ Fixed

- **Severity**: Low
- **File**: `backend/yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/ErrorCodeConstants.java:34`
- **Description**: `ORDER_NOT_REFUNDING(1008007028, "订单当前不在退款中")` 已定义，但 `StoreOrderServiceImpl.orderRefund` 在非退款中状态下仍抛出 `ORDER_STATUS_ERROR`，未使用新错误码。
- **Fix applied**: 已在 `orderRefund` 的 `!REFUND_STATUS_1` 分支替换为 `ORDER_NOT_REFUNDING`，错误提示更精确。

### 3. Admin 订单列表操作列宽可能放不下双按钮 ✅ Fixed

- **Severity**: Low
- **File**: `admin/src/views/mall/order/storeOrder/index.vue:227`
- **Description**: 操作列宽度仍为 `150px`。退款中订单行现在同时出现“确认退款”+“拒绝退款”+“更多”，150px 在常见分辨率下会出现换行或被截断。
- **Fix applied**: 已将操作列宽度扩至 `180px`。

### 4. `StoreOrderDO` 存在重复 import — Acknowledged

- **Severity**: Low
- **File**: `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/dal/dataobject/storeorder/StoreOrderDO.java`
- **Description**: 文件中有大量重复的 `import java.math.BigDecimal;` 和 `import java.time.LocalDateTime;`。经核对，这些重复 import 为历史遗留，本次 diff 仅新增 `refundReapply` 字段，未引入新的重复 import。
- **Decision**: 为保持 PR 聚焦，不在本次变更中大规模清理历史代码；可在后续代码整理时统一处理。

### 5. 小程序退款入口仍受 `rawStatus === 2` 限制 — 待产品确认

- **Severity**: Low
- **File**: `miniapp/pages/orders/orders.js:236`、`miniapp/pages/order-detail/order-detail.js:217`
- **Description**: `canApplyRefund` 仅当 `status === 2` 时允许申请/重新申请。若设备订单在完成后进入 `status === 3`，用户将无法发起退款或重新申请。该限制为既有逻辑。
- **Decision**: 本次保持既有 `status === 2` 限制；如业务需要放宽至 `status >= 2`，可在后续迭代中单独调整。

### 6. 拒绝日志未记录是否允许再次申请 ✅ Fixed

- **Severity**: Low
- **File**: `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderServiceImpl.java:563-565`
- **Description**: 状态日志内容为 `管理员拒绝退款，原因：{reason}`，`technical-design.md` 中示例为 `商家拒绝退款，原因：xxx，允许/不允许再次申请`。
- **Fix applied**: 已在日志消息中追加 `，允许再次申请` / `，不允许再次申请`，订单记录可完整回溯。

---

## 复核项确认

| 检查项 | 结论 | 说明 |
|--------|------|------|
| 实现符合需求规格 | 是 | 核心状态流转、字段、接口均符合。 |
| API 契约符合 `contract-changes.md` | 是 | `/order/store-order/reject-refund` 路径、字段、权限一致；App 退款接口复用现有契约。 |
| 无硬编码密钥 | 是 | 未引入新密钥/密码。 |
| 租户隔离保持 | 是 | 查询/更新通过 MyBatis Plus 拦截器自动注入 tenant_id。 |
| 数据库迁移脚本 | 是 | `backend/sql/upgrade-2026-07-05-order-refund-reject.sql` 已提供，修改 comment 并新增 `refund_reapply` 列。 |
| 测试覆盖 | 是 | `admin/e2e/order-refund-reject.spec.ts` 覆盖核心、边界、列表/日志场景。 |
| 功能分支命名 | 是 | `feat/order-refund-reject` 符合约定。 |
| 无显著代码重复 | 是 | 状态映射在前后端分别维护，属于正常分层。 |
| SQL 注入/XSS | 未发现新增风险 | 既有 `FIND_IN_SET` 字符串拼接为历史代码；本次未引入新注入点。 |
| UI/UX 一致性 | 基本符合 | 语义色/组件使用一致，操作列宽度建议优化。 |

---

## PASS / FAIL Verdict

**PASS** — 功能实现完整，契约匹配，未发现阻塞性缺陷。建议合并在修复/确认上述 Low 级别改进项后进行。
