# 商品不限制库存变更报告

## Summary

商品、规格（SKU 属性值）、选项三个层级支持将库存设为 `-1`，表示不限制库存。库存为 `-1` 时，下单、购物车、订单计算等流程跳过库存校验与扣减；退款/取消时也不恢复库存。管理端库存输入允许 `-1`，并在列表/导入预览中展示为“不限制库存”。

## Repositories

- `backend`（`yshop-drink`）
  - `StoreProductMapper`：商品库存扣减/恢复 SQL 过滤 `stock != -1`。
  - `StoreProductAttrValueMapper`：规格库存扣减/恢复 SQL 过滤 `stock != -1`。
  - `StoreOptionMapper`：选项库存扣减/恢复 SQL 过滤 `stock != -1`。
  - `AppStoreProductServiceImpl`：`checkProductStock`、`decProductStock`、`incProductStock` 识别 `-1` 并跳过。
  - `StoreProductServiceImpl.computedProduct`：规格全为 `-1` 时商品库存设为 `-1`。
  - `StoreOptionServiceImpl.deductStock`、`ProductOptionOrderApiImpl.deductOptionStock`：选项 `-1` 跳过扣减。
  - `ProductImportServiceImpl`、`ProductImportPreviewReqVO`：店铺导入新增 `unlimitedStock` 参数，开启后商品和规格库存统一写入 `-1`。
- `admin`（`yshop-drink-vue`）
  - `StoreProductForm.vue`：商品/套餐库存、规格库存输入增加 `-1` 提示。
  - `StoreOptionForm.vue`：选项库存输入 `min` 改为 `-1`。
  - `storeProduct/index.vue`：库存列展示“不限制库存”；批量改库存允许 `-1`。
  - `storeOption/index.vue`：库存列展示“不限制库存”。
  - `productImport/index.vue`：参数页增加“不限制库存”开关；导入预览库存列展示“不限制库存”。

## Contracts

- API：无变化；`stock` 字段允许 `-1`。
- DB：无表结构变化；`stock` 字段使用 `-1` 作为“不限制库存”约定值。
- MQ：无变化。
- 权限：无新增/变化。
- 外部系统：无变化。

## Verification

- `mvn -pl yshop-module-mall/yshop-module-product-biz,yshop-module-mall/yshop-module-order-biz,yshop-module-mall/yshop-module-store-import-biz -am clean compile -DskipTests`：SUCCESS
- `pnpm build:prod`：Build successful
- `pnpm ts:check`：失败（既有类型定义缺失，非本次引入）

## Pull Requests

- backend: https://gitee.com/icepolar/yshop-drink/pulls/67
- admin: https://gitee.com/icepolar/yshop-drink-vue/pulls/42

## Risks

- 积分商城、秒杀、拼团等活动库存未纳入本期。
- 历史订单退款/取消恢复库存时，`-1` 保持为 `-1`（已过滤）。

## References

- `governance/feature-docs/product-unlimited-stock/requirements-spec.md`
- `governance/feature-docs/product-unlimited-stock/contract-changes.md`
- `governance/feature-docs/product-unlimited-stock/ui-ux-design.md`
- `governance/feature-docs/product-unlimited-stock/test-notes.md`
- `governance/feature-docs/product-unlimited-stock/review-report.md`
