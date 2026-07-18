# ADR-005: 商品基础规格 + 选项加价定价模型

## 状态

- 已接受（2026-07-18 模型重构：门店选项库改为「分组 + 选项」两层多对多；同日增补商品级显示名覆盖与商品私有选项）

## 背景

奶茶、快餐等场景中，商品的杯型、奶茶底、加料、甜度等是独立加价/选择维度，并非每个组合都需独立定价。现有多规格（`yshop_store_product.spec_type=1`）通过笛卡尔积穷举 SKU 并逐条定价，导致 SKU 数量指数增长、同一选项加价重复维护、前端价格表格过大。约束：不破坏现有单/多规格逻辑、历史订单不可变、跨模块仅经 `-api`。

初版采用平铺门店小料库，丢失了「分组」维度（如「奶茶底」下常规/鲜奶/燕麦奶），与实际运营模型不符，故重构为两层主从。

## 决策

新增 `has_options` 开关叠加在现有 `spec_type` 之上，构建「规格 + 选项」模型：规格层复用现有 SKU 表做基础价与库存；选项层为**门店级两层主从**——`store_option_group`（分组，含必选/多选/min/max）+ `store_option`（选项，含名称/价格/库存/状态），二者经 `store_option_group_item` **多对多**关联，选项可跨组复用、价格库存单一事实源。属性与小料统一为一套模型（选项 `price=0` 即纯选择维度）。商品经 `product_option_group_ref` **引用门店分组**，不复制选项；`ref.display_name` 支持商品级组名覆盖（解决多店同义分组区分，如「甜度1/甜度2」在商品侧统一显示「甜度」，参照规格三表 `attr_result` 商品维度冗余思路）；`store_option.product_id` 支持商品私有选项（NULL=门店共享，有值=该商品私有，不入共享库）。下单服务端实时计价 `规格价 + Σ 选中选项 price`（不按份数），扣规格 SKU 与选中选项库存，订单行写入选项快照。

## 方案对比

| 方案 | Pros | Cons |
|------|------|------|
| A: 两层门店选项库（分组+选项多对多）+ 商品引用分组 | 符合运营模型（奶茶底/加料分组）；选项跨组复用不重复维护；价格库存单一事实源 | 表多一张多对多关联；商品侧需维护分组引用 |
| B: 平铺门店小料库（初版） | 实现简单 | 无分组维度，无法表达「奶茶底」归类；与属性结构不对称 |
| C: 商品各自维护选项 | 无共享复杂度 | 门店内同一选项重复建，改价需逐商品改 |
| D: 新增 `spec_type=2` | 模式语义清晰 | 侵入现有 spec_type 分支；下单/库存/详情多处新增分支 |

## 影响

- 对现有代码：纯增量。`spec_type=0/1` 与 `is_combo` 逻辑不变；`has_options` 与 `is_combo` 互斥。
- 对 API/合约：新增门店选项库（分组/选项/指派）、商品引用分组 admin 接口；C 端商品详情按 `spec_type + has_options` 返回规格 + 选项分组；下单带选项、服务端实时计价。契约见 `feature-docs/product-option-pricing/contract-changes.md`。
- 对数据库：新增 `yshop_store_option_group`、`yshop_store_option`、`yshop_store_option_group_item`、`yshop_product_option_group_ref` 四表；`yshop_store_product` 加 `has_options`；`yshop_store_order_cart_info` 加 `option_snapshot`、`option_total_delta`。废弃初版 `yshop_store_topping`、`yshop_product_option_group`、`yshop_product_option`。均含回滚。
- 对部署/运维：仅 DB 增量迁移，无新外部依赖、无 MQ 变更；test 已部署初版需清旧表重跑迁移。

## 相关

- 相关的合约：`governance/feature-docs/product-option-pricing/contract-changes.md`
- 需求：`governance/BACKLOG/BACKLOG-004-product-option-pricing.md`
