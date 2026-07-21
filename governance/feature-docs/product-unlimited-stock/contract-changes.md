# 商品不限制库存契约变更

## API

- 管理端商品创建/更新接口 `POST/PUT /admin-api/product/store-product`：`stock` 字段允许 `-1`，表示不限制库存；其他取值保持原有语义。
- 管理端规格（SKU）创建/更新接口：`attrValue[].stock` 允许 `-1`。
- 管理端选项创建/更新接口 `POST/PUT /admin-api/product/store-option`：`stock` 允许 `-1`。
- 小程序/订单侧查询商品库存接口：库存为 `-1` 时返回充足，不暴露具体负数语义。
- 响应结构不变；错误码不变，但 `-1` 不再触发 `PRODUCT_STOCK_LESS`、`STORE_OPTION_STOCK_LESS`、`STORE_PRODUCT_STOCK_ERROR`。

## DB

- `yshop_store_product.stock`、`yshop_store_product_attr_value.stock`、`yshop_store_option.stock` 使用 `-1` 作为“不限制库存”约定值。
- 商品和 SKU 库存字段不得使用 `unsigned`；升级脚本为 `backend/sql/upgrade-2026-07-21-product-unlimited-stock.sql`。
- 现有数据保持原值；本次仅扩展业务语义，不提供迁移脚本。

## 库存校验与扣减

- 商品层：`StoreProductServiceImpl.computedProduct` 中 `total SKU stock <= 0` 判断需跳过 `-1` 规格；`AppStoreProductServiceImpl.checkProductStock` 在 `stock == -1` 时直接返回。
- 规格层：`StoreProductAttrValueMapper.decStockIncSales` SQL 增加 `and stock != -1`；`AppStoreProductServiceImpl.decProductStock` 跳过 `-1` 规格扣减。
- 选项层：`StoreOptionMapper.decStock` SQL 增加 `and stock != -1`；`StoreOptionServiceImpl.deductStock`、`ProductOptionOrderApiImpl.deductOptionStock` 跳过 `-1` 选项。
- 恢复库存：`incStock*` 系列 SQL 增加 `and stock != -1`，避免 `-1` 被非预期修改。
- 库存交换（换规格）：`OrderApiImpl` 中旧规格恢复与新规格扣减均按 `-1` 跳过处理。
- 店铺导入：新增 `unlimitedStock` 参数（Boolean），`true` 时本次导入所有商品/规格库存统一写入 `-1`；源文件库存为 `-1` 时也按不限制库存处理。

## 权限与数据范围

- 无新增权限；现有商品、选项编辑权限继续控制库存修改。
- 租户隔离保持现有逻辑不变。

## 依赖

- 不新增 MQ、外部系统或跨模块 API。
- 订单模块调用 `product-api` 的库存校验/扣减能力，由商品模块内部识别 `-1` 语义。

## ADR

- N/A：未引入新的架构决策，仅扩展现有 `stock` 字段取值语义。
