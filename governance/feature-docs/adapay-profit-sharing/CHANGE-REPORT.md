# CHANGE-REPORT: Adapay 分账规则与订单状态变更

## 1. 业务目标

为店铺按角色配置分账计费规则，按规则计算各方分账金额与手续费承担方；走 Adapay 分账的订单在分账成功或回退到虚拟余额结算后，订单状态更新为待评价。

## 2. 影响仓库和主要文件

| 仓库 | 主要文件 |
|---|---|
| `backend/` | `sql/upgrade-adapay-profit-sharing-rule.sql` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/dal/dataobject/profitsharingrule/ProfitSharingRuleDO.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingrule/ProfitSharingRuleServiceImpl.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingorder/ProfitSharingOrderServiceImpl.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/ProfitSharingOrderController.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/job/ProfitSharingSettlementJob.java` |
| | `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java` |
| | `yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/api/OrderApi.java` |
| | `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/api/OrderApiImpl.java` |
| | `yshop-module-pay/yshop-module-pay-biz/pom.xml` |
| `admin/` | `src/api/pay/profitSharingRule.ts` |
| | `src/views/mall/store/profitSharingRule/index.vue` |
| | `src/views/mall/store/profitSharingRule/ProfitSharingRuleForm.vue` |
| | `src/views/mall/store/shop/ShopForm.vue` |
| | `src/views/mall/store/profitSharingRecord/index.vue` |
| `governance/` | `feature-docs/adapay-profit-sharing/requirements-spec.md` |
| | `feature-docs/adapay-profit-sharing/technical-design.md` |
| | `feature-docs/adapay-profit-sharing/contract-changes.md` |
| | `feature-docs/adapay-profit-sharing/test-notes.md` |

## 3. 契约变化摘要

### API

| 端点 | 方法 | 说明 | 权限 |
|---|---|---|---|
| `/admin-api/pay/profit-sharing-rule/list-by-shop` | GET | 按店铺查询分账计费规则 | `pay:profit-sharing-rule:query` |
| `/admin-api/pay/profit-sharing-rule/save-set` | POST | 保存/覆盖店铺整套规则 | `pay:profit-sharing-rule:update` |
| `/admin-api/pay/profit-sharing-order/page` | GET | 分账订单分页 | `pay:profit-sharing:query` |
| `/admin-api/pay/profit-sharing-order/get` | GET | 分账订单详情 | `pay:profit-sharing:query` |
| `/admin-api/pay/profit-sharing-order/retry` | POST | 失败分账手动重试 | `pay:profit-sharing:update` |

### 内部 API

- `ProfitSharingRuleApi.validateAndGetRules(Long shopId, BigDecimal payPrice)`
- `ProfitSharingRuleApi.isRuleComplete(Long shopId)`
- `OrderApi.markOrderSettled(String orderId)`

### DB

- 新建 `yshop_adapay_profit_sharing_rule`
- 新建 `yshop_adapay_profit_sharing_order_item`
- 扩展 `yshop_adapay_profit_sharing_order`（`calculation_type`, `fee_bearer_role`）
- 追加菜单与权限（`system_menu` / `system_role_menu`）

### 依赖

- `yshop-module-pay-biz` 新增依赖 `yshop-module-order-api`

### 枚举

- 新增 `ProfitSharingRoleEnum`（平台/店铺/配送方/销售方）
- 新增 `ProfitSharingCalculationTypeEnum`（计费规则/佣金比例回退）

## 4. DB 迁移脚本名

`sql/upgrade-adapay-profit-sharing-rule.sql`

## 5. 测试结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端编译 | `mvn clean compile -DskipTests` | ✅ BUILD SUCCESS |
| 前端构建 | `pnpm run build:local` | ✅ Build successful |
| 前端类型检查 | `pnpm run ts:check` | ❌ 失败，原因：既有类型定义文件缺失（`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`），与本次变更无关 |
| 单元测试 | — | ⚠️ 未发现新增测试 |

> 注：构建结果为上一轮 Review 实测数据；本次修复仅调整状态校验、错误码、事件传参和展示字段，未引入新的编译依赖或契约变更。

## 6. 风险与注意事项

1. **测试覆盖不足**：本次新增金额计算、状态机、Job 调度等关键逻辑，但仍无自动化测试覆盖，建议补充 `ProfitSharingRuleServiceImpl.validateAndGetRules`、`ProfitSharingOrderServiceImpl.executeSharing/fallbackToRevenue` 及 `ProfitSharingSettlementJob` 的单元测试。
2. **M-4 整单替换语义**：实现要求一次提交 4 条不同角色并拒绝重复角色，与测试计划 R-06 的“去重后整单替换”期望存在偏差。当前以代码严格校验为准，需同步更新测试计划或明确需求。
3. **订单状态更新失败需监控**：分账成功/回退后 `orderApi.markOrderSettled` 已改为 try-catch，失败仅记录日志，不会回滚分账状态。建议对这类日志增加告警，避免订单状态长期不一致。

## 7. 建议 PR 标题和描述

**标题**: `feat(pay/order): Adapay 分账计费规则与订单状态变更`

**描述**:

```
- 新增店铺分账计费规则，按角色（平台/店铺/配送方/销售方）配置比例与手续费承担方
- 支付时按规则计算各角色分账金额并固化到分账明细表；无规则时 fallback 到 commission_rate
- 日终 Job 分账确认并更新 yshop_store_order.status = 2（待评价）
- 分账失败时回退到 RevenueJob，并同样更新订单状态为待评价
- 管理后台新增店铺分账计费规则配置页、分账结算记录详情展示计算方式/承担方/明细
- 店铺编辑页新增分账计费规则入口
- 修复：分账成功后先持久化状态再更新订单；手动重试增加状态校验；fallback 校验平台收款人启用状态；规则保存错误码统一；明细返回 recipientName；前端手续费互斥与成功提示

关联文档：
- governance/feature-docs/adapay-profit-sharing/requirements-spec.md
- governance/feature-docs/adapay-profit-sharing/technical-design.md
- governance/feature-docs/adapay-profit-sharing/contract-changes.md
- governance/feature-docs/adapay-profit-sharing/test-notes.md
- governance/feature-docs/adapay-profit-sharing/review-report.md
```
