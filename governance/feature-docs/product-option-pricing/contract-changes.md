# 商品选项加价契约变更

只展开变化项。命名遵循 `yshop_` 表前缀、`/admin-api` `/app-api` 前缀、`{code:0,data,msg}` 响应。

> 本版为模型重构：门店选项库 = 分组 + 选项（多对多），商品引用分组。替代最初的平铺小料库。

## API

### 门店选项库 — 分组（product-biz，admin）

- `GET /admin-api/product/option-group/page`：分页查询门店选项分组（按 `shopId`、`name`）。
- `GET /admin-api/product/option-group/get?id=`：查询分组详情（含组内选项，实时带选项价/库存/状态）。
- `GET /admin-api/product/option-group/list-by-shop?shopId=`：门店分组列表（商品引用/详情用，各组带选项）。
- `POST /admin-api/product/option-group/create`：新增分组，字段 `shopId,name,required,multiple,minSelect,maxSelect,sort`。
- `PUT /admin-api/product/option-group/update`：修改分组（同创建字段 + `id`）。
- `DELETE /admin-api/product/option-group/delete?id=`：删除分组；被商品引用时禁止删除。

### 门店选项库 — 选项（product-biz，admin）

- `GET /admin-api/product/option/page`：分页查询门店选项（按 `shopId`、`name`、`status`）。
- `GET /admin-api/product/option/get?id=`：查询单个选项。
- `GET /admin-api/product/option/list-by-shop?shopId=`：门店选项列表（指派/编辑用）。
- `POST /admin-api/product/option/create`：新增选项，字段 `shopId,name,price,stock,status,sort`。
- `PUT /admin-api/product/option/update`：修改选项；改价/改名对所有引用（分组/商品）实时生效。
- `DELETE /admin-api/product/option/delete?id=`：删除选项；被分组引用时禁止删除（需先移除）。
- `PUT /admin-api/product/option-group/assign-options`：设置某分组的选项集合（多对多全量覆盖），body `{ groupId, items:[{optionId,isDefault,sort}] }`。

### 商品主表（product-biz，admin）

- 商品创建/更新请求 VO 增加 `hasOptions`（0/1）。保存时校验：`hasOptions=1` 与 `isCombo=1` 互斥（返回明确业务错误）。
- `PUT /admin-api/product/store-product/option-groups`：设置商品引用的门店分组，body `{ productId, groups:[{groupId, displayName}] }`（全量覆盖，排序按传入顺序；`displayName` 为空则用共享组名）。
- `GET /admin-api/product/store-product/option-groups?productId=`：查询商品引用的分组（带选项实时价/库存/状态；组名已应用 `displayName` 覆盖，并回传 `displayName` 供编辑回填）。

### 商品详情（C 端，app-api）

- 复用现有商品详情接口，响应按 `specType + hasOptions` 扩展：
  - `specs`：规格层（复用 SKU，每行 price/stock/unique）。
  - `optionGroups`：商品引用的分组 `[{id,name,required,multiple,minSelect,maxSelect,sort,options:[{id,name,price,stock,status,isDefault,sort}]}]`；选项实时取 `store_option`，缺货/停用透出 `status`。
- 兼容性：仅新增字段，存量 `specType` 商品响应不变。

### 下单计价与快照（order-biz，app-api）

- 下单/加购请求：商品行增加 `specUnique`（规格 SKU）+ `optionSelections:[{groupId,optionId}]`（无份数）。
- 服务端实时计价：`price = 规格SKU.price + Σ 选中选项 price`；不信任前端金额。
- 校验：必选组已选且 ≥ `minSelect`；多选组 ≤ `maxSelect`；单选组（`multiple=0`）≤ 1；选项 `status` 可用且库存充足。
- 错误语义：库存不足、必选缺失、超选择数、选项停用均返回明确业务错误码。
- 幂等：下单沿用现有下单幂等机制；库存扣减原子完成；计价结果透传到购物车快照，不在异步任务重算。

## DB

升级脚本：`backend/sql/upgrade-2026-07-17-product-option-pricing.sql`（主表结构）、`backend/sql/upgrade-2026-07-18-option-group-unique-deleted.sql`（唯一键修复）、`backend/sql/upgrade-2026-07-18-option-group-display-name.sql`（display_name + product_id 增量），均含回滚语句。所有新表含 `tenant_id`、`create_time`、`update_time`、`deleted`。

- 废弃（DROP）旧平铺模型表：`yshop_store_topping`、`yshop_product_option_group`、`yshop_product_option`（test 已部署旧模型，重写脚本清理）。
- `yshop_store_product` 新增列 `has_options` tinyint(1) NOT NULL DEFAULT 0。存量默认 0，行为不变。
- `yshop_store_order_cart_info` 新增列 `option_snapshot` json NULL、`option_total_delta` decimal(10,2) NOT NULL DEFAULT 0。
- 新增 `yshop_store_option_group`（门店选项分组）：`id,tenant_id,shop_id,name,required,multiple,min_select,max_select,sort` + 标准字段；索引 `(tenant_id,shop_id)`。
- 新增 `yshop_store_option`（门店选项）：`id,tenant_id,shop_id,product_id,name,price,stock,status,sort` + 标准字段；索引 `(tenant_id,shop_id)`、`(product_id)`。`product_id` 为 NULL 表示门店共享，有值表示该商品私有（不出现在共享库、不被其他商品选）。
- 新增 `yshop_store_option_group_item`（分组-选项多对多）：`id,tenant_id,group_id,option_id,is_default,sort` + 标准字段；索引 `(tenant_id,group_id)`、`(option_id)`；唯一约束 `(group_id,option_id)`。
- 新增 `yshop_product_option_group_ref`（商品-分组引用）：`id,tenant_id,product_id,option_group_id,display_name,sort` + 标准字段；索引 `(tenant_id,product_id)`、`(option_group_id)`；唯一约束 `(product_id,option_group_id)`。`display_name` 为商品级分组显示名（覆盖共享组名，解决多店同义分组区分场景）。
- 回滚：DROP 四张新表；`ALTER TABLE ... DROP COLUMN has_options / option_snapshot / option_total_delta`；删除「选项库」菜单。

## MQ

N/A：不新增 topic；库存扣减在下单事务内同步完成。

## 权限与数据范围

- 不新增权限点，全部复用商品权限（现有编码前缀 `shop:store-product:*`）：
  - 选项库（分组+选项）查询/管理复用 `shop:store-product:query` / `create` / `update` / `delete`。
  - 商品引用分组复用 `shop:store-product:update`。
- 数据范围：选项库按 `shop_id` 限定门店范围；商品引用按商品所属门店/部门范围；均含 `tenant_id` 由 MyBatis Plus 自动隔离。

## 依赖

- 不新增 Maven/前端第三方依赖。
- 模块间：`order-biz → product-api`（选项计价/校验/扣库存）。选项库与商品同处 product 模块，商品详情聚合与下单计价不跨模块读选项。

## 外部系统

N/A：不涉及外部系统变更。

## ADR

ADR-005 已更新为本模型（分组+选项两层、多对多、商品引用分组、不按份数）。
