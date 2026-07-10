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
| 测试环境数据库迁移 | `mysql < upgrade-adapay-profit-sharing-dynamic-role.sql` | ✅ 执行成功（已修复 creator/updater 字段差异） |
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
- `sql/upgrade-adapay-profit-sharing-dynamic-role.sql`

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
- 新增迁移脚本 `sql/upgrade-adapay-profit-sharing-dynamic-role.sql` 会补录历史 fallback 记录的明细并删除主表固定字段。
- admin 分账结算记录列表/详情不再展示固定的平台抽成/店铺分账金额，改由详情内「分账明细」子表展示。
