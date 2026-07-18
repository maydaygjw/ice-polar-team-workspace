# 商品选项加价技术设计

来源：`requirements-spec.md` + `governance/BACKLOG/BACKLOG-004`。契约细节见 `contract-changes.md`。

> 本版为模型重构：门店选项库改为「分组 + 选项」两层主从（多对多），替代最初的平铺小料库。

## 模块影响

- `backend / yshop-module-product-biz`：商品新增 `has_options`；新增门店选项库（分组、选项、分组-选项关联）与商品-分组引用的 DO、Mapper、Service、admin Controller；商品详情聚合返回规格 + 引用分组。
- `backend / yshop-module-order-biz`：下单计价（规格价 + Σ 选项价）、扣减规格 SKU 与选项库存、`yshop_store_order_cart_info` 增加选项快照。
- `backend / product-api`：向 order 模块暴露选项计价/校验/扣库存能力（跨模块仅经 `-api`）。
- `admin`：门店选项库管理页（分组+选项+跨组指派）+ 商品编辑页引用分组。
- 小程序：本期不改造；C 端仅新增/扩展只读接口供后续对接。

## 关键决策

1. **新定价模式与既有模式隔离，不引入第三个 spec_type。** `spec_type` 保持 `0` 单规格 / `1` 多规格语义不变；选项加价通过新增 `has_options` 开关叠加。选项模式下基础价仍由规格 SKU（`yshop_store_product_attr_value`）提供——SKU 行即「规格层」（杯型），每行独立 price/stock。`has_options` 与 `is_combo` 互斥。
2. **属性与小料统一为一套「分组 + 选项」模型。** 不再有单独的 `group_type`；选项是否加价由选项自身 `price` 决定（0=纯选择维度，>0=加价项）。消除了旧模型中属性/小料两套字段的分裂。
3. **门店选项库两层主从 + 多对多。** `store_option_group`（分组）与 `store_option`（选项）均按 `shop_id` 门店共享；选项是独立门店资源，通过 `store_option_group_item` 与分组多对多关联，可跨组复用。选项价格/库存/状态只在 `store_option` 维护一份（单一事实源），改价全店生效。
4. **商品引用分组，不复制选项。** 商品经 `product_option_group_ref` 勾选引用哪些门店分组；商品不冗余选项，详情/下单实时取门店库。
5. **不按份数。** 选中一个选项即加一次价、扣一次库存；去掉旧模型的 `max_quantity`/份数乘法。计价公式简化为 `规格价 + Σ 选中选项 price`。
6. **计价单一入口、下单实时计算。** 服务端按选中规格 + 选中选项实时计价，不信任前端金额；校验组必选/min/max、单选组≤1、选项状态与库存。下单计价结果透传到购物车快照，不在 `@Async` 中重算。
7. **库存只扣两处。** 规格 SKU 库存（`yshop_store_product_attr_value.stock`）+ 选项库存（`store_option.stock`，各一次）。均用原子 guarded update 防超卖。
8. **选项快照写订单行。** `yshop_store_order_cart_info` 增加 `option_snapshot`（JSON：所选规格 + 各组选项 + 单价）与 `option_total_delta`（选项加价合计），行 `price` 存最终单价。历史订单行不变。
9. **租户与数据范围。** 新表均含 `tenant_id`；选项库按 `shop_id` 限定门店范围。

## Maven 模块边界

- 门店选项库、商品-分组引用 DO/Service/Controller 均放 `product-biz`；`product-api` 新增选项计价/校验/扣库存接口 + DTO。
- `order-biz` 依赖 `product-api`（并经既有模式直接读 product service）完成计价与扣库存。
- 不改动 `shop` 模块；不新增 MQ、不新增外部系统。

## 流程

```text
admin 维护门店选项库：分组 + 选项 + 选项指派到分组(多对多)
admin 商品开启 has_options 并勾选引用门店分组
        ↓
C 端商品详情：spec_type + has_options → 规格 + 引用分组（选项实时带 price/stock/status）
        ↓
下单：选规格 + 各组选项（单选组≤1、必选满足 min）
        ↓ 服务端实时计价
价格 = 规格价 + Σ 选中选项 price
        ↓ 事务（原子 guarded update）
扣规格SKU库存 + 扣选中选项库存(各一次)
        ↓
写订单行：price=规格价+选项加价合计, option_snapshot=JSON快照（下单时计价结果透传）
```

## 风险

- **模型重构返工**：替代已部署的平铺小料模型，test 需清旧表重跑迁移；旧 topping 代码/菜单需移除。
- **选项跨组共享并发**：同一选项被多分组/多商品引用，高并发下需原子扣减防超卖。
- **改价一致性**：下单实时计价 + 快照透传，避免「加购价 ≠ 结算价」；订单快照保留单价与加价明细便于对账。
- **删除约束**：选项被分组引用时需先移除；分组被商品引用时需先解除商品引用。
- **数据迁移**：纯新增表 + 商品加列，无存量业务数据改写；`has_options` 默认 `0`，存量商品行为不变。

## 契约变化引用

详见 `contract-changes.md`：API（门店选项库、商品引用分组、order 计价/快照、app 商品详情）、DB（新表 + 加列）、权限、依赖。
