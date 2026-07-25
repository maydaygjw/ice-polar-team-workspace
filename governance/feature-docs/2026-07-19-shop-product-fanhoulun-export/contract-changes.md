# 店铺商品饭火轮模板导出契约变更

## API

- `GET /admin-api/product/store-product/export-fanhoulun?shopId={shopId}`
  - 导出当前选中店铺的全部普通商品为饭火轮模板 `dishes.xls`。
  - 商家账号登录时后端自动取当前登录 `shopId`，请求参数 `shopId` 被忽略。
  - 平台账号登录时必须传入 `shopId`。
  - 响应为 Excel 二进制流，`Content-Disposition: attachment;filename=dishes.xls`。

## DB

- 不新增表，不修改现有表结构。
- 查询涉及表：
  - `yshop_store_product`：商品主数据。
  - `yshop_store_product_attr`：规格维度名称。
  - `yshop_store_product_attr_value`：SKU 价格与库存。
  - `yshop_store_product_category`：分类名称。

## 权限与数据范围

- 复用权限 `shop:store-product:export`。
- 数据范围遵循现有门店隔离：
  - 商家账号 `SecurityFrameworkUtils.getLoginUser().getShopId() > 0` 时，只能导出本店。
  - 平台账号 `shopId == 0` 或为空时，可传入目标 `shopId` 导出。

## DTO / VO

- `StoreProductFHLExportReqVO`
  - `shopId`: Integer，可选。
- `FHLProductExportVO`
  - 19 个 String 字段，对应 `dishes.xls` 19 列。

## 依赖

- 无新增跨模块依赖。
- 使用现有 `yshop-spring-boot-starter-excel` 的 `ExcelUtils.write`。
- 使用现有 `SecurityFrameworkUtils` 做登录门店隔离。
