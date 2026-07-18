# 商品选项加价技术设计

来源：`requirements-spec.md` + `governance/BACKLOG/BACKLOG-004`。契约细节见 `contract-changes.md`。

## 模块影响

- `backend / yshop-module-product-biz`：商品新增 `has_options`；新增门店级小料库 `store_topping`、商品选项组/选项（属性组 + 小料组）的 DO、Mapper、Service、admin Controller；商品详情聚合返回 `specs + option_groups`。
- `backend / yshop-module-order-biz`：下单计价（规格价 + 小料加价 × 份数）、扣减规格 SKU 与小料库存、`yshop_store_order_cart_info` 增加选项快照。
- `backend / product-api`：向 order 模块暴露只读的选项组/小料查询与计价、库存扣减能力（跨模块仅经 `-api`）。
- `admin`：门店小料库管理页 + 商品编辑页选项组配置。
- 小程序：本期不改造；C 端仅新增/扩展只读接口供后续对接。

## 关键决策

1. **新定价模式与既有模式隔离，不引入第三个 spec_type。** `spec_type` 保持 `0` 单规格 / `1` 多规格语义不变；选项加价通过新增 `has_options` 开关叠加。选项模式下基础价仍由规格 SKU（`yshop_store_product_attr_value`）提供，`spec_type=1` 但不做全组合独立定价——SKU 行即「规格层」（杯型），每行独立 price/stock。运营只维护规格行，不再穷举维度组合。
   - 权衡：复用现有 SKU 表与下单/库存主链路，改动最小；代价是商品编辑 UI 需区分「规格维度」与「选项维度」。
2. **选项与既有「套餐（combo）」完全解耦。** 现有 `yshop_store_product_combo_group(_detail)` 是套餐捆绑（`is_combo`），与选项加价无关；新表独立命名，不复用、不修改 combo 表。
3. **三层模型落库。** 规格层复用 `yshop_store_product_attr` / `yshop_store_product_attr_value`；属性与小料统一收敛到两张新表 `product_option_group` / `product_option`，用 `group_type` 区分 `attribute` / `topping`。小料选项通过 `topping_id` 关联门店小料库。
   - 属性不加价、不维护库存：属性选项行仅 name/is_default/sort，无 price_delta、无 stock。
   - 小料选项行不复制价格/库存，只存 `topping_id` + `max_quantity`，价格与库存实时取自 `store_topping`（单一事实源，门店改价全店生效）。
4. **门店小料库放 product 模块。** 小料是商品定价/加料的组成部分，与商品选项组同属商品域；`store_topping` 与选项组、商品同模块，商品详情聚合、下单计价无需跨模块读小料，依赖最简。小料按 `shop_id` 做门店维度共享。
5. **计价单一入口、下单实时计算。** 下单时按「选中规格 price + Σ 小料 price × 份数」在服务端实时计算，不信任前端金额；购物车只存所选内容（规格 unique + 选项 id + 份数），下单重算。属性不参与金额。
6. **选项快照写入订单行 JSON。** 在 `yshop_store_order_cart_info` 增加 `option_snapshot`（JSON：所选规格 + 各组选项 + 小料份数 + 单价/加价明细）与 `option_total_delta`（小料加价合计），行 `price` 存最终单价（规格价 + 加价）。历史订单行不变，符合「历史不可变」。
7. **库存只扣两处。** 规格 SKU 库存（`yshop_store_product_attr_value.stock`）+ 门店小料库库存（`store_topping.stock`，按份数）。属性不扣。库存校验与扣减沿用现有下单事务，小料库按 `shop_id` 行锁防超卖。
8. **租户与数据范围。** 新表均含 `tenant_id`；小料库按 `shop_id` 限定门店范围，admin 仅可管理本门店/授权门店小料与商品选项。

## Maven 模块边界

- 小料库、选项组/选项 DO/Service/Controller 均放 `product-biz`；`product-api` 新增小料/选项组只读查询、计价与库存扣减接口 + DTO。
- `order-biz` 依赖 `product-api` 完成计价与扣库存，不直接读商品/小料表。
- 不改动 `shop` 模块；不新增 MQ、不新增外部系统。

## 流程

```text
admin 维护门店小料库(product) ─┐
admin 配置商品选项组(product) ─┘
        ↓
C 端商品详情：spec_type + has_options → specs + option_groups（小料价/库存实时取 store_topping）
        ↓
下单：选规格 unique + 各组选项 + 小料份数
        ↓ 服务端实时计价(经 product-api)
校验必选/min/max/限购 + 校验规格SKU库存 & 小料库存
        ↓ 事务
扣规格SKU库存 + 扣小料库库存(按份数)
        ↓
写订单行：price=规格价+小料加价合计, option_snapshot=JSON快照
```

## 风险

- **小程序未接入**：本期仅交付接口与后台，端到端下单路径无法由真实 C 端触发，需以接口级测试验收。
- **与 combo/多规格并存**：商品同时 `is_combo` 或已是笛卡尔积多规格时，需明确 `has_options` 与既有模式的互斥/共存规则（见 contract-changes 兼容性）。
- **小料库存超卖**：多商品共享小料库，高并发下同店小料需行锁/原子扣减。
- **改价一致性**：下单实时计价 + 快照记录，避免「加购价 ≠ 结算价」争议；需在订单快照中保留单价与加价明细以便对账。
- **数据迁移**：纯新增表 + 商品加列，无存量数据改写；`has_options` 默认 `0`，存量商品行为不变。

## 契约变化引用

详见 `contract-changes.md`：API（product 选项组、shop 小料库、order 计价/快照、app 商品详情）、DB（3 张新表 + 2 处加列）、权限、依赖。
