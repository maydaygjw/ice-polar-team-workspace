# 技术设计：店铺商品饭火轮模板导出

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-product-biz` | 新增 | 独立的 `FHLExportService` 与 `FHLExportMapper`，专门处理饭火轮模板导出。 |
| `yshop-module-product-biz` | 修改 | `StoreProductController` 增加 `/export-fanhoulun` 端点，委托给 `FHLExportService`。 |
| `yshop-module-product-biz` | 修改 | 新增 `FHLProductExportVO` 与 `StoreProductFHLExportReqVO`。 |
| `admin` | 修改 | 商品管理列表页增加导出按钮与 API 调用。 |

## 关键决策

1. **后端使用独立 Service + Mapper**
   - 不扩展 `StoreProductService` 与 `StoreProductMapper` 的职责，避免核心商品服务混入第三方模板导出逻辑。
   - 新增 `FHLExportService` 负责数据组装，新增 `FHLExportMapper` 负责按店铺查询商品。
2. **数据查询一次性聚合**
   - 按 `shopId` 查询商品列表后，批量查询分类、规格属性、SKU 属性值，避免 N+1。
3. **模板列顺序强制固定**
   - VO 使用 `@ExcelProperty(index = n, value = "列名")`，避免字段声明顺序变化导致列错位。
4. **权限复用**
   - 复用现有权限 `shop:store-product:export`，不新增菜单和权限 SQL。
5. **商家账号数据隔离**
   - `FHLExportMapper` 内部使用 `SecurityFrameworkUtils.getLoginUser().getShopId()` 做最终过滤；平台账号登录时使用请求中的 `shopId`。
6. **兼容历史 SKU 数据**
   - SKU 持久化格式为逗号分隔，导出同时兼容历史竖线分隔格式。历史 SKU 缺少已声明的规格维度时，使用属性定义中的选项补齐组合，避免 `口味` 等维度因旧数据缺失而留空。

## 导出列映射

| 列号 | 表头 | VO 字段 | 单规格来源 | 多规格来源 |
|------|------|---------|------------|------------|
| 1 | 排序 | `sort` | `StoreProductDO.sort` | 同单规格 |
| 2 | 所属分类 | `categoryName` | `ProductCategoryDO.name`（取 `cateId` 第一个 ID） | 同单规格 |
| 3 | 商品名称 | `storeName` | `StoreProductDO.storeName` | 同单规格 |
| 4 | 商品主图 | `image` | `StoreProductDO.image` | 同单规格 |
| 5 | 外卖售价 | `price` | `StoreProductDO.price` | 空 |
| 6 | 店内价格 | `otPrice` | `StoreProductDO.otPrice` | 空 |
| 7 | 商品库存 | `stock` | `StoreProductDO.stock` | 空 |
| 8 | 餐盒费 | `boxFee` | `StoreProductDO.boxFee` | 同单规格 |
| 9 | 是否招牌 | `isHot` | 固定 `2` | 固定 `2` |
| 10 | 是否上架 | `isShow` | `StoreProductDO.isShow` | 同单规格 |
| 11 | 规格维度1 | `specDim1` | 空 | 第 1 个 `attrName` |
| 12 | 规格值1 | `specValue1` | 空 | SKU `sku` 按逗号（兼容竖线）拆分后第 1 段 |
| 13 | 规格维度2 | `specDim2` | 空 | 第 2 个 `attrName` |
| 14 | 规格值2 | `specValue2` | 空 | SKU `sku` 按逗号（兼容竖线）拆分后第 2 段 |
| 15 | 规格维度3 | `specDim3` | 空 | 第 3 个 `attrName` |
| 16 | 规格值3 | `specValue3` | 空 | SKU `sku` 按逗号（兼容竖线）拆分后第 3 段 |
| 17 | SKU外卖价格 | `skuPrice` | 空 | `StoreProductAttrValueDO.price` |
| 18 | SKU店内价格 | `skuOtPrice` | 空 | 与 `skuPrice` 相同 |
| 19 | SKU库存 | `skuStock` | 空 | `StoreProductAttrValueDO.stock` |

## 类设计

### VO

- `FHLProductExportVO`：19 个 String 字段，按 index 标注 `@ExcelProperty`。
- `StoreProductFHLExportReqVO`：包含 `shopId`（Integer，可选）。

### Service

- `FHLExportService.export(StoreProductFHLExportReqVO reqVO): List<FHLProductExportVO>`
  - 解析 effectiveShopId。
  - 查询商品、分类、属性、SKU。
  - 组装 VO 列表。

### Mapper

- `FHLExportMapper.selectProductsByShopId(Integer shopId)`：查询 `isCombo == 0` 的商品，按 `sort ASC, id ASC` 排序。
- 复用现有 `StoreProductAttrMapper`、`StoreProductAttrValueMapper`、`ProductCategoryMapper` 查询属性与分类。

### Controller

- `StoreProductController.exportFanhoulun(StoreProductFHLExportReqVO, HttpServletResponse)`
  - 调用 `FHLExportService.export`。
  - 使用 `ExcelUtils.write(response, "dishes.xls", "数据", FHLProductExportVO.class, datas)` 输出。

## 流程

```text
商品管理页选择门店 → 点击导出饭火轮模板
        ↓
GET /product/store-product/export-fanhoulun?shopId=xxx
        ↓
StoreProductController → FHLExportService
        ↓
FHLExportMapper 按 shopId 查询普通商品
        ↓
批量查询分类、规格属性、SKU 属性值
        ↓
组装 FHLProductExportVO 列表
        ↓
ExcelUtils.write 输出 dishes.xls
```

## 风险与回滚

- 风险：多规格商品规格维度超过 3 个时数据截断，但模板本身只支持 3 维，属预期行为。
- 风险：分类 ID 解析失败时所属分类为空，不影响其他列导出。
- 回滚：仅新增独立 Service/Mapper/VO，不修改核心商品表结构；删除新增文件即可回滚。
