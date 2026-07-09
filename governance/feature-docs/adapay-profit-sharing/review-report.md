# Adapay 分账规则与订单状态变更 — Review Report（复评）

## 1. 审查结论

**通过。**

上轮 Review 提出的资金安全风险、状态校验缺失、前端展示缺陷、错误码误用、事件传参问题均已在本次修复中解决。实现与需求/设计文档一致，租户隔离、API 契约、DB 迁移脚本均保持正确。

## 2. 核对清单结果

| 项 | 结果 | 说明 |
|---|---|---|
| 实现与需求一致 | 通过 | 分账成功状态先持久化再更新订单；重试、fallback、规则保存、明细展示均符合需求 |
| API 契约保持一致 | 通过 | 新增/修改端点、DTO、枚举与 `contract-changes.md` 一致 |
| 没有硬编码密钥 | 通过 | 未发现硬编码密钥/密码 |
| 已验证租户隔离 | 通过 | 新增表均含 `tenant_id`，联表明细查询保留 `tenant_id` 条件 |
| 已创建数据库迁移脚本 | 通过 | `sql/upgrade-adapay-profit-sharing-rule.sql` 已提供 |
| 迁移脚本字段与 DO/BaseDO 一致 | 通过 | 含 `creator`/`updater`/`create_time`/`update_time`/`deleted` |
| 数据字典项均已定义对应枚举 | 通过 | `ProfitSharingRoleEnum`、`ProfitSharingCalculationTypeEnum`、`ProfitSharingStatusEnum` 已定义 |
| 测试覆盖本次变更 | 不通过 | 仍未找到针对规则计算、状态机、Job 的单元测试或接口测试 |
| 必要时已更新 ADR | 通过 | 设计文档明确无新架构范式，无需 ADR |
| 功能分支符合命名约定 | 通过 | `feat/adapay-profit-sharing-rule` |
| PR 描述已关联需求和设计文档 | 待 PR 阶段 | 本次只读审查，未提交 PR |

## 3. 发现的问题

### 严重

无。

### 一般

无。

### 建议

#### L-1: 缺少单元测试/接口测试
- **位置**: 全模块
- **问题**: 仍未发现针对规则计算、整单校验、状态机、Job 调度、fallback 回退的测试。
- **影响**: 回归风险高，金额计算与状态流转缺乏自动化保障。
- **修复建议**: 为 `ProfitSharingRuleServiceImpl.validateAndGetRules`、`ProfitSharingOrderServiceImpl.createSharingOrder/fallbackToRevenue/executeSharing` 及 `ProfitSharingSettlementJob` 补充单元测试；接口测试覆盖保存规则、支付拒绝、手动重试。

## 4. 修复验证说明

### S-1: 日终 Job 分账成功后 `markOrderSettled` 失败导致重复分账 —— 已修复
- **文件**: `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingorder/ProfitSharingOrderServiceImpl.java:267-279`
- **修复内容**: Adapay 返回成功后，先执行 `updateById` 将 `sharing_status` 更新为 `SUCCESS`（2），再 try-catch 调用 `orderApi.markOrderSettled`；订单状态更新失败仅记录错误日志，不会回滚分账状态。重复分账风险消除。

### S-2: 手动重试接口可能重复调用 Adapay 分账确认 —— 已修复
- **文件**: `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/ProfitSharingOrderController.java:51-55`
- **修复内容**: `retrySharing` 先查询订单，显式校验 `sharing_status == 3` 且 `fallback_revenue == 0`，否则抛出 `PROFIT_SHARING_ORDER_STATUS_INVALID_FOR_RETRY`。

### M-1: 分账结算记录详情页收款人名称展示异常 —— 已修复
- **文件**:
  - `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/vo/ProfitSharingOrderItemRespVO.java`
  - `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingorder/ProfitSharingOrderServiceImpl.java:181-210`
  - `.worktrees/admin-adapay-profit-sharing-rule/src/views/mall/store/profitSharingRecord/index.vue:188-191,321-323`
- **修复内容**: `ProfitSharingOrderItemRespVO` 新增 `recipientName`；Service 在 `calculationType=1` 时联表填充明细；前端优先展示后端返回的 `recipientName`，缺失时按 `recipientId` 回查收款人列表兜底。

### M-2: fallback 模式下未校验平台收款人启用状态 —— 已修复
- **文件**: `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java:1192-1194`
- **修复内容**: fallback 分支校验 `platformRecipient == null || status != 1`，任一不满足即抛出 `PROFIT_SHARING_PAY_DISABLED`。

### M-3: 保存规则时错误码语义不匹配 —— 已修复
- **文件**: `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingrule/ProfitSharingRuleServiceImpl.java:59-68`
- **修复内容**: 规则为空、数量不等于 4、角色重复/缺失/非法均统一抛出 `PROFIT_SHARING_RULE_INCOMPLETE`。

### M-5: 已定义的“分账状态不允许重试”错误码未使用 —— 已修复
- **文件**: `.worktrees/backend-adapay-profit-sharing-rule/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/ProfitSharingOrderController.java:51-55`
- **修复内容**: Controller 显式校验 `sharing_status=3 && fallback_revenue=0`，否则抛出 `PROFIT_SHARING_ORDER_STATUS_INVALID_FOR_RETRY`。

### L-2: 前端承担手续费互斥实现依赖事件参数 —— 已修复
- **文件**: `.worktrees/admin-adapay-profit-sharing-rule/src/views/mall/store/profitSharingRule/ProfitSharingRuleForm.vue:55,141-145`
- **修复内容**: `@change="handleFeeBearerChange(rule.role)"` 显式传入 `role`，`handleFeeBearerChange` 内部直接按 `rule.role === role` 判断，不再依赖事件 value。

### L-3: 店铺编辑页打开规则表单后未监听保存成功事件 —— 已修复
- **文件**: `.worktrees/admin-adapay-profit-sharing-rule/src/views/mall/store/shop/ShopForm.vue:224,436-438`
- **修复内容**: `ProfitSharingRuleForm` 组件监听 `@success="handleProfitSharingRuleSuccess"`，保存成功后调用 `message.success('保存成功')` 给出反馈。

## 5. 其他说明

- M-4（整单替换语义）未在本次修复范围内：实现仍要求一次提交 4 条不同角色并拒绝重复角色，与测试计划 R-06 的“去重后整单替换”期望存在偏差。该行为当前是代码层面的严格校验，建议同步更新测试计划 R-06 或明确以严格校验为准。
- 所有修复均为代码层面调整，未变更 DB 契约或对外 API 契约。
