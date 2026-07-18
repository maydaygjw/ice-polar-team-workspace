# ADR-005: 商品基础规格 + 选项加价定价模型

## 状态

- 已接受

## 背景

奶茶、快餐等场景中，商品的杯型、甜度、加料等是独立加价/选择维度，并非每个组合都需独立定价。现有多规格（`yshop_store_product.spec_type=1`）通过笛卡尔积穷举 SKU 并逐条定价，导致 SKU 数量指数增长、同一选项加价重复维护、前端价格表格过大。需要一种更轻量的「基础规格 + 选项加价」模式。约束：不破坏现有单/多规格逻辑、历史订单不可变、跨模块仅经 `-api`。

## 决策

新增 `has_options` 开关叠加在现有 `spec_type` 之上，构建三层模型：规格层复用现有 SKU 表做基础价与库存，属性层（不加价、不维护库存、组级可配单/多选）与小料层（门店级共享库、按可选份数加价并扣库存）统一收敛到 `product_option_group` / `product_option` 两张表，小料价格/库存以门店小料库 `store_topping` 为单一事实源。小料库与选项组同处 product 模块，下单服务端实时计价。

## 方案对比

| 方案 | Pros | Cons |
|------|------|------|
| A: `has_options` 叠加 + 复用 SKU 做规格层 | 不扩 `spec_type` 语义；复用下单/库存主链路；改动最小；存量商品不变 | 商品编辑 UI 需区分规格维度与选项维度 |
| B: 新增 `spec_type=2` 选项模式 | 模式语义清晰 | 侵入现有 spec_type 分支逻辑；下单/库存/详情多处需新增分支，改动面大 |
| C: 每个商品私有小料 | 实现简单 | 门店内同一小料重复维护，改价需逐商品改，违背门店共享诉求 |
| D: 小料选项行冗余价格/库存 | 读取无需 JOIN | 门店改价无法全店同步，出现多份事实源 |

## 影响

- 对现有代码：纯增量。`spec_type=0/1` 与 `is_combo` 逻辑不变；`has_options` 与 `is_combo` 互斥。
- 对 API/合约：新增小料库、选项组 admin 接口；C 端商品详情按 `spec_type + has_options` 扩展 `specs + option_groups`；下单请求带选项、服务端实时计价。契约见 `feature-docs/product-option-pricing/contract-changes.md`。
- 对数据库：新增 `yshop_store_topping`、`yshop_product_option_group`、`yshop_product_option` 三表；`yshop_store_product` 加 `has_options`；`yshop_store_order_cart_info` 加 `option_snapshot`、`option_total_delta`。均含回滚。
- 对部署/运维：仅 DB 增量迁移，无新外部依赖、无 MQ 变更。

## 相关

- 相关的合约：`governance/feature-docs/product-option-pricing/contract-changes.md`
- 需求：`governance/BACKLOG/BACKLOG-004-product-option-pricing.md`
