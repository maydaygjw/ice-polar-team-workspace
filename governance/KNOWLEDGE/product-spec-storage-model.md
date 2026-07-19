# 商品规格存储模型（SPU/SKU 三表）

yshop（源自 CRMEB）的经典规格模型。一个商品的规格以**三种形态冗余**存于三张表。

## 三表分工

| 表 | 角色 | 一行代表 | 受众 |
|---|---|---|---|
| `yshop_store_product_attr` | 规格模板（SPU 维度） | 一个规格名 + 该规格全部可选值（`attr_values` 逗号拼接） | 编辑页分组展示 |
| `yshop_store_product_attr_value` | **SKU 明细（事实源）** | 一个具体组合（`sku`）+ 价格/库存/条码/图片/`unique` | 下单、扣库存 |
| `yshop_store_product_attr_result` | 编辑缓存（冗余） | 整单 JSON `{attr:[...],value:[...]}`，**每商品 1 行** | 编辑页一键回显 |

## 写入流程

后台保存商品 → `insertYxStoreProductAttr`（StoreProductAttrServiceImpl.java:81）：

1. `clearProductAttr` **全量删** attr + attr_value
2. `saveBatch` 重建两表
3. `{attr,value}` 整单 JSON 存入 attr_result（先删后插，保 1 行）

## 读取路径

- **下单/库存/价格** → 只查 `attr_value`，按 `sku` 或 `unique` 命中
- **后台编辑回显** → 只查 `attr_result.result`，不重新组装

## 设计取舍与坑

1. **`attr_result` 纯冗余**：内容可由前两表推导，只为回显原始表单结构。绕过 `insertYxStoreProductAttr` 直改库会导致与两表不一致。校验：`attr_value` 行数 应等于 `result.value` 数组长度。
2. **`attr_values` 逗号拼接**：非规范化码表，无法 join/统计/国际化，仅供分组展示。
3. **`sku` 是字符串 key**：`detail.values()` 经 `StrUtils.compareTo` 排序后逗号拼接。值含逗号或规格名/顺序变更会导致 key 错位，且无法关系 join。
4. **双标识**：一个 SKU 同时有 `sku` 字符串与 `unique` UUID，下单快照用 `unique`。

## 结论

事实源仅 `attr_value`；`attr` 与 `attr_result` 由同一份提交数据派生、可丢弃重建。新「规格+选项」模型见 [[adr-005-product-option-pricing]]，选项加价不再走此三表。
