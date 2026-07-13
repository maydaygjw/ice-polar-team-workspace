# 测试记录 — Adapay 分账结算（角色明细化需求变更）

## 验证结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端全量编译 | `mvn compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 编译 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 order-biz 编译 | `mvn -pl yshop-module-mall/yshop-module-order-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 单元测试 | `mvn -pl yshop-module-pay/yshop-module-pay-biz test` | ✅ 10 tests passed |
| 后端 order-biz 单元测试 | `mvn -pl yshop-module-mall/yshop-module-order-biz test` | ❌ 既有环境问题（`NoClassDefFoundError: StoreShopMapper`），与本次变更无关 |
| admin 类型检查 | `pnpm ts:check` | ⚠️ 既有环境类型定义缺失，与本次变更无关 |
| admin 生产构建 | `pnpm run build:prod` | ⚠️ 未执行（类型定义环境缺失） |
| 测试环境数据库迁移 | `mysql < upgrade-2026-07-07-adapay-profit-sharing.sql` | ✅ 执行成功（已修复 creator/updater 字段差异） |
| 测试环境后端部署 | `mvn clean package -DskipTests` + `start-yshop.sh` | ✅ 端口 8888 监听，`/doc.html` 返回 200 |
| 测试环境 admin 部署 | `pnpm build:dev` + Nginx 替换 | ✅ `/index.html` 返回 200 |

## 变更文件

### backend
- `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/dto/profitsharing/CreateSharingOrderDTO.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/dal/dataobject/profitsharingorder/ProfitSharingOrderDO.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitsharingorder/vo/ProfitSharingOrderRespVO.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitsharingorder/ProfitSharingOrderServiceImpl.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/resources/mapper/profitsharingorder/ProfitSharingOrderMapper.xml`
- `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java`
- `sql/upgrade-2026-07-07-adapay-profit-sharing.sql`

### admin
- `src/api/mall/store/profitSharingRecord/index.ts`
- `src/views/mall/store/profitSharingRecord/index.vue`

### governance
- `feature-docs/adapay-profit-sharing/meta.yaml`
- `feature-docs/adapay-profit-sharing/requirements-spec.md`
- `feature-docs/adapay-profit-sharing/technical-design.md`
- `feature-docs/adapay-profit-sharing/contract-changes.md`
- `feature-docs/adapay-profit-sharing/test-notes.md`
- `feature-docs/adapay-profit-sharing/CHANGE-REPORT.md`
- `feature-docs/adapay-profit-sharing/review-report.md`

## 注意事项

- 分账订单主表 `yshop_adapay_profit_sharing_order` 已移除 `commission_amount`、`shop_amount`、`platform_recipient_id`、`shop_recipient_id`，角色信息全部下沉到 `yshop_adapay_profit_sharing_order_item`。
- 佣金比例回退模式下，创建分账记录时也写入平台、店铺两条明细，保证所有分账执行/回退逻辑统一走明细表。
- 新增迁移脚本 `sql/upgrade-2026-07-07-adapay-profit-sharing.sql` 会补录历史 fallback 记录的明细并删除主表固定字段。
- admin 分账结算记录列表/详情不再展示固定的平台抽成/店铺分账金额，改由详情内「分账明细」子表展示。

## 后续增强：服务订单完成时直接执行 Adapay 分账

### 变更原因

管理后台点击「完成服务」后，订单状态变为 `PENDING_REVIEW`（3）。此时若订单通过 Adapay 支付，系统会直接调用 Adapay `PaymentConfirm.create` 执行分账，而不是仅创建挂起记录。

### 验证结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端 order-biz / site-biz 编译 | `(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz,yshop-module-site/yshop-module-site-biz -am clean compile -q)` | ✅ BUILD SUCCESS |

### 新增/变更文件

- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/api/OrderApiImpl.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderService.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java`
- `backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderServiceImpl.java`（顺带修复 `AdapayPayService.reverse` 方法名不存在导致的编译错误）

### 触发条件

- `OrderApiImpl.updateOrderStatus` 被调用；
- 新状态为 `OrderStatusEnum.STATUS_3`（3，待评价）；
- 订单 `payType = adapay` 且 `paid = 1`；
- 店铺已启用分账且配置完整；
- 调用 `ProfitSharingOrderService.executeSharing` 直接执行分账。

### 注意事项

- 分账执行成功后，`executeSharing` 会调用 `orderApi.markOrderSettled`，订单状态会从 `3` 变为 `2`；
- 若 Adapay 分账执行失败、店铺分账配置不完整或找不到 Adapay 已支付记录，完成服务操作会失败并回滚订单状态；
- 新增错误码 `PROFIT_SHARING_EXECUTE_FAILED`（1008009037）用于分账执行失败场景。
