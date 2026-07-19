# 店铺商品饭火轮模板导出

## Scope

### In

- 管理后台「商品管理」列表页增加「导出饭火轮模板」按钮。
- 导出当前选中店铺的全部普通商品为 `.xls` 文件。
- 导出列数、列名、列顺序与 `/Users/gejunwen/code/holun/weiqing/addons/hlmall/excel/dishes.xls` 完全一致（共 19 列）。
- 支持单规格商品一行导出，多规格商品按 SKU 展开为多行导出。
- 平台账号登录时按页面所选 `shopId` 导出；商家账号登录时导出当前登录店铺。
- 复用现有权限 `shop:store-product:export`，不新增菜单或权限。

### Out

- 不修改现有通用商品导出 `/product/store-product/export-excel`。
- 不导入商品到饭火轮系统，只导出符合其导入模板的文件。
- 不处理套餐商品（`isCombo == 1`）。
- 不导出模板中的示例数据行。

## Use Cases

1. 平台管理员进入商品管理列表，选择门店，点击「导出饭火轮模板」，下载 `dishes.xls` 用于饭火轮批量导入。
2. 商家账号登录时直接进入商品管理列表，点击导出按钮即可下载本店商品模板文件。
3. 多规格商品导出后，每行一个 SKU，规格维度/值按模板列顺序填充。

## Business Rules

- 只导出 `isCombo == 0` 的普通商品；套餐商品不参与导出。
- 单规格商品（`specType == 0`）输出一行，第 5-7 列（外卖售价、店内价格、商品库存）必填，第 11-19 列留空。
- 多规格商品（`specType == 1`）每个 SKU 输出一行，第 5-7 列留空，第 11-19 列必填。
- 规格维度按 `store_product_attr.id` 升序排列，与 SKU 的 `sku` 字段按 `|` 拆分后的顺序对齐；最多支持 3 个维度，超出部分截断。
- 分类名称通过 `cateId` 解析后取第一个分类 ID 映射到 `yshop_store_product_category.name`。
- 店内价格：单规格取 `StoreProductDO.otPrice`；多规格 SKU 取与外卖售价相同（`StoreProductAttrValueDO.price`）。
- 是否招牌固定输出 `2`。
- 排序按商品 `sort` 升序输出，同 `sort` 按 `id` 升序。
- 文件名为 `dishes.xls`。

## Frontend Requirements

- 在商品管理列表页的「新增」按钮旁增加「导出饭火轮模板」按钮。
- 按钮受权限 `shop:store-product:export` 控制。
- 商家账号登录时不展示门店选择器，导出时不传 `shopId`。
- 平台账号登录时导出当前页面选中的 `shopId`；未选择门店时给出提示。
- 导出过程中按钮显示 loading，避免重复点击。

## Edge Cases

- 所选门店没有任何普通商品时，导出空表头的 Excel 文件。
- 门店存在多规格商品但 SKU 数据缺失时，该商品跳过。
- 商家账号越权访问其他门店数据由后端 `SecurityFrameworkUtils` 兜底。
- 多规格商品规格维度超过 3 个时只取前 3 维。
- `cateId` 为空或解析不到分类时，所属分类列为空。

## Acceptance Criteria

- 后端编译通过：`mvn clean compile -pl yshop-module-mall/yshop-module-product-biz -am`。
- 管理端类型检查通过：`pnpm ts:check`。
- 导出文件可在 Excel/WPS 中正常打开，列头与模板 `dishes.xls` 完全一致。
- 单规格商品导出后第 5/6/7 列有值，第 11-19 列为空。
- 多规格商品导出后第 5/6/7 列为空，规格/SKU 列有值。
- 套餐商品不出现在导出结果中。
- 商家账号只能导出本店商品。

## Assumptions

- 饭火轮模板 19 列结构保持不变。
- 导出为一次性同步导出，不引入异步任务。
- 图片地址直接输出 `StoreProductDO.image` 原值，不做转存或压缩。
