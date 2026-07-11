# CHANGE-REPORT: Adapay 分账结算 — 分账角色明细化

## 1. 业务目标

将分账订单从「主表硬编码平台/店铺字段」重构为「每个角色一条明细记录」，支持后续动态扩展角色：
- `yshop_adapay_profit_sharing_order` 不再保留 `commission_amount`、`shop_amount`、`platform_recipient_id`、`shop_recipient_id`；
- 所有角色金额、收款人、手续费承担标记统一存入 `yshop_adapay_profit_sharing_order_item`；
- 佣金比例回退模式同样写入平台、店铺两条明细，保持执行与回退逻辑一致。

## 2. 影响仓库和主要文件

| 仓库 | 主要文件 |
|---|---|
| `backend/` | `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/dto/profitsharing/CreateSharingOrderDTO.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/dal/dataobject/profitsharingorder/ProfitSharingOrderDO.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/vo/ProfitSharingOrderRespVO.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingorder/ProfitSharingOrderServiceImpl.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/resources/mapper/profitsharingorder/ProfitSharingOrderMapper.xml` |
| | `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java` |
| | `sql/upgrade-adapay-profit-sharing-dynamic-role.sql` |
| `admin/` | `src/api/mall/store/profitSharingRecord/index.ts` |
| | `src/views/mall/store/profitSharingRecord/index.vue` |
| `governance/` | `feature-docs/adapay-profit-sharing/meta.yaml` |
| | `feature-docs/adapay-profit-sharing/requirements-spec.md` |
| | `feature-docs/adapay-profit-sharing/technical-design.md` |
| | `feature-docs/adapay-profit-sharing/contract-changes.md` |
| | `feature-docs/adapay-profit-sharing/test-notes.md` |
| | `feature-docs/adapay-profit-sharing/review-report.md` |
| | `feature-docs/adapay-profit-sharing/CHANGE-REPORT.md` |

## 3. 契约变化摘要

### API

无新增端点。复用已有：

| 端点 | 方法 | 说明 | 权限 |
|---|---|---|---|
| `/pay/profit-sharing-order/page` | GET | 分账订单分页 | `pay:profit-sharing:query` |
| `/pay/profit-sharing-order/get` | GET | 分账订单详情 | `pay:profit-sharing:query` |
| `/pay/profit-sharing-order/retry` | POST | 失败分账重试 | `pay:profit-sharing:update` |

### DTO 变更

- `CreateSharingOrderDTO` 移除 `commissionAmount`、`platformRecipientId`、`shopRecipientId`；`items` 改为必填。
- `ProfitSharingOrderRespVO` 移除 `commissionAmount`、`shopAmount`、`platformRecipientName`、`shopRecipientName`；详情通过 `items` 展示。

### DB

- 新增迁移脚本 `sql/upgrade-adapay-profit-sharing-dynamic-role.sql`：
  - 将历史 `calculation_type=2` 记录的固定字段数据补录到 `yshop_adapay_profit_sharing_order_item`；
  - 删除 `yshop_adapay_profit_sharing_order` 的 `commission_amount`、`shop_amount`、`platform_recipient_id`、`shop_recipient_id`。

### 错误码

无新增。

## 4. DB 迁移脚本名

`sql/upgrade-adapay-profit-sharing-dynamic-role.sql`

## 5. 测试结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端全量编译 | `mvn compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 编译 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 order-biz 编译 | `mvn -pl yshop-module-mall/yshop-module-order-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 单元测试 | `mvn -pl yshop-module-pay/yshop-module-pay-biz test` | ✅ 10 tests passed |
| 后端 order-biz 单元测试 | `mvn -pl yshop-module-mall/yshop-module-order-biz test` | ❌ 既有环境问题（`NoClassDefFoundError: StoreShopMapper`），与本次变更无关 |
| admin 类型检查 | `pnpm ts:check` | ⚠️ 既有环境类型定义缺失，与本次变更无关 |

## 6. 风险与注意事项

1. **不兼容变更**：`ProfitSharingOrderRespVO` 移除 `commissionAmount`/`shopAmount`，admin 列表/详情同步调整；调用方若依赖该字段需升级。
2. **数据迁移**：上线前必须通过 `upgrade-adapay-profit-sharing-dynamic-role.sql` 迁移历史数据；若 production 已有大量 fallback 模式记录，需评估迁移耗时。
3. **测试覆盖不足**：未新增针对动态角色的单元测试，建议后续补充 `createSharingOrder`、`buildDivMembers`、`fallbackToRevenue` 的单元测试。
4. **order-biz 测试环境**：`CommissionServiceImplTest` 因 `StoreShopMapper` 类找不到失败，为既有环境问题，不影响本次变更。

## 7. 建议 PR 标题和描述

**标题**: `refactor(pay/admin): Adapay 分账订单角色明细化，支持动态扩展角色`

**描述**:

```
- yshop_adapay_profit_sharing_order 移除 commission_amount/shop_amount/platform_recipient_id/shop_recipient_id
- 所有角色金额、收款人、手续费承担标记下沉到 yshop_adapay_profit_sharing_order_item
- 佣金比例回退模式同样写入平台、店铺两条明细
- 统一分账执行(buildDivMembers)与回退(fallbackToRevenue)逻辑，全部基于明细表
- admin 分账结算记录列表/详情移除固定平台/店铺金额列，改由明细子表展示
- 新增迁移脚本 upgrade-adapay-profit-sharing-dynamic-role.sql

关联文档：
- governance/feature-docs/adapay-profit-sharing/requirements-spec.md
- governance/feature-docs/adapay-profit-sharing/technical-design.md
- governance/feature-docs/adapay-profit-sharing/contract-changes.md
- governance/feature-docs/adapay-profit-sharing/test-notes.md
- governance/feature-docs/adapay-profit-sharing/review-report.md
```

## 8. PR 链接

| 仓库 | PR |
|---|---|
| `backend` | [#46](https://gitee.com/icepolar/yshop-drink/pulls/46) |
| `admin` | [#24](https://gitee.com/icepolar/yshop-drink-vue/pulls/24) |
| `workspace (governance)` | [#4](https://github.com/maydaygjw/ice-polar-team-workspace/pull/4) |

## 9. 后续增强：服务订单完成时直接执行 Adapay 分账

### 业务行为

管理后台完成服务订单后，订单状态变为 `PENDING_REVIEW`（3）。若该订单通过 Adapay 支付，系统直接调用 Adapay `PaymentConfirm.create` 执行分账；执行成功后订单状态会被 `executeSharing` 更新为 `2`（已收货/已结算）。

### 影响文件

- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/api/OrderApiImpl.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderService.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java`
- `backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderServiceImpl.java`（修复预存在的 `AdapayPayService.reverse` 方法名错误）

### 关键逻辑

- `OrderApiImpl.updateOrderStatus` 增加 `@Transactional`；
- 仅在状态变为 `3`、支付方式为 `adapay`、已支付时调用 `AppStoreOrderService.executeProfitSharingIfNeeded`；
- 通过 `PayOutOrderNoService.findPaidByOrderIdAndPayType` 获取 `adapayPaymentId`；
- 复用原 `AppStoreOrderServiceImpl.createProfitSharingOrder` 死代码创建分账记录，并立即调用 `ProfitSharingOrderService.executeSharing`；
- 分账执行失败时抛出 `PROFIT_SHARING_EXECUTE_FAILED`，订单状态回滚。

### 验证

```bash
(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz,yshop-module-site/yshop-module-site-biz -am clean compile -q)
# ✅ BUILD SUCCESS
```

### 风险

- 该钩子对所有状态变为 `3` 的 Adapay 订单生效，不仅限于服务订单；当前只有服务订单完成会触发此状态变化；
- 若 `PayOutOrderNoDO` 中未记录 `adapay_payment_id` 或 Adapay 接口调用失败，完成服务将失败；
- 分账成功后订单状态会从 `3` 变为 `2`，前端/报表需兼容该状态流转。
