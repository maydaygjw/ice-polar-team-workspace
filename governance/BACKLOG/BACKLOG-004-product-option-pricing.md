# Backlog Item: 商品选项加价模式

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-004 |
| Title | 商品选项加价模式 |
| Status | `draft` |
| Priority | `P1` |
| Created | 2026-07-17 |
| Author | gejunwen |
| Tags | product, sku, pricing, option, topping |

## Problem / Need

当前多规格商品通过笛卡尔积生成 SKU 组合并逐条定价。对于奶茶、快餐等场景，各选项只是独立加价/减价，并非每个组合都需要独立定价。继续用笛卡尔积会导致：

- SKU 数量随维度指数增长，运营维护困难
- 同一个选项的加价重复维护多次
- 新增一个选项会触发大量 SKU 变更
- 前端价格编辑表格过大，体验差

需要一种更轻量的「基础 SKU + 选项加价」模式来支持此类业务。

## Context

- 当前 `yshop_store_product.spec_type` 为 `0`（单规格）/ `1`（多规格笛卡尔积）
- 多规格 SKU 存储在 `yshop_store_product_attr_value`，`sku` 字段为规格值逗号拼接
- 触发需求的具体场景：茶饮商品点单页，杯型、甜度、加料等以独立加价形式呈现
- 参考美团外卖商家后台模型：将「多规格」拆分为「规格」「属性」「小料」三层
  - **规格**：杯型、尺寸、重量，决定基础价，有独立库存/打包费
  - **属性**：温度、糖度、口味，默认不加价，但允许灵活配置加价
  - **小料**：加料、配菜，门店级统一维护，商品共享，支持多选/重复选

## Proposed Data Model

### 商品主表扩展

- `yshop_store_product.has_options`：是否启用选项/小料，`0` 否 / `1` 是

### 规格层（杯型）— 复用现有表

- `yshop_store_product_attr`：规格维度
- `yshop_store_product_attr_value`：规格 SKU
  - 可扩展 `pack_fee`（打包费）字段
  - 每条 SKU 独立维护 `price` / `stock` / `ot_price` / `unique`

### 门店小料库（新增）

- `store_topping`
  - `store_id`：门店维度统一维护
  - `name`：小料名称
  - `price`：统一售价
  - `stock`：库存
  - `status` / `sort`

> 小料修改后，门店内所有引用该小料的商品同步生效。

### 商品选项组（新增）

- `product_option_group`
  - `product_id`
  - `group_type`：`attribute`（属性）/ `topping`（小料）
  - `name`：组名，如「甜度」「加料」
  - `required`：是否必选
  - `multiple`：是否可多选
  - `repeat_allowed`：同一选项是否可重复选（如 2 份珍珠）
  - `min_select` / `max_select`
  - `default_option_id`
  - `sort`

- `product_option`
  - `group_id`
  - `name`
  - `price_delta`：加价/减价
  - `stock`：属性级库存，小料可空
  - `is_default`
  - `sort`
  - `topping_id`：小料组时关联 `store_topping`
  - `max_quantity`：同一选项最多选几份

## Price Calculation

```
商品单价 = 选中规格 price
       + Σ 选中属性 price_delta
       + Σ 选中小料 price_delta × 数量
```

## Inventory Deduction

- 扣减规格 SKU 库存
- 扣减门店小料库库存（按实际份数）
- 属性默认不扣库存

## Order Snapshot

- `order_item` 增加 `option_snapshot` JSON 字段及 `option_total_delta`
- 建议新增 `order_item_option` 明细表记录每组选项、价格、数量

## Acceptance Criteria

- [ ] 商品新增 `has_options` 字段，不影响现有单/多规格逻辑
- [ ] 新增门店级 `store_topping` 小料库，支持名称/价格/库存/排序
- [ ] 新增 `product_option_group` 与 `product_option`，支持属性组与小料组
- [ ] 选项组支持单选/多选/必选/可选/重复选/限购数量/默认选项
- [ ] 商品详情接口根据 `spec_type` + `has_options` 返回 `specs` + `option_groups`
- [ ] 下单价格计算：规格价 + 属性加价 + 小料加价 × 数量
- [ ] 库存扣减：规格 SKU 库存 + 门店小料库库存
- [ ] 订单/购物车记录用户所选规格、属性、小料快照
- [ ] admin 后台支持配置门店小料库与商品选项组
- [ ] 小料在门店维度统一维护，修改后关联商品同步生效
