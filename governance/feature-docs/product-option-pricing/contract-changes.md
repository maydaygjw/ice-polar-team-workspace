# 商品选项加价契约变更

只展开变化项。命名遵循 `yshop_` 表前缀、`/admin-api` `/app-api` 前缀、`{code:0,data,msg}` 响应。

## API

### 门店小料库（product-biz，admin）

- `GET /admin-api/product/topping/page`：分页查询门店小料（按门店范围）。
- `GET /admin-api/product/topping/get?id=`：查询单个小料。
- `POST /admin-api/product/topping/create`：新增小料，字段 `shopId,name,price,stock,status,sort`。
- `PUT /admin-api/product/topping/update`：修改小料；改价/改名对门店内所有引用商品实时生效（不写历史快照）。
- `DELETE /admin-api/product/topping/delete?id=`：删除小料；已被商品选项引用时禁止删除，需先解除引用。

### 商品选项组（product-biz，admin）

- `GET /admin-api/product/option-group/list?productId=`：查询商品的全部选项组及选项。
- `POST /admin-api/product/option-group/save`：整组保存商品选项（按 `productId` 全量覆盖该商品选项组 + 选项）；属性组选项不含价格/库存，小料组选项携带 `toppingId,maxQuantity`。
- 选项组字段：`groupType(attribute|topping),name,required,multiple(默认0),minSelect,maxSelect,defaultOptionId,sort`。
- 选项字段：属性组 `name,isDefault,sort`；小料组 `toppingId,maxQuantity,sort`。

### 商品主表（product-biz，admin）

- 商品创建/更新请求 VO 增加 `hasOptions`（0/1）。商品编辑保存时校验：`hasOptions=1` 与 `isCombo=1` 互斥（返回明确业务错误）。

### 商品详情（C 端，app-api）

- 复用现有商品详情接口，响应按 `specType + hasOptions` 扩展：
  - `specs`：规格层（复用 SKU，每行 price/stock/unique）。
  - `optionGroups`：`[{groupType,name,required,multiple,minSelect,maxSelect,options:[...]}]`；小料选项实时带出 `store_topping` 的 `name,price,stock,status`，小料缺货/停用时 `status` 置不可用。
- 兼容性：仅新增字段，存量 `specType` 商品响应不变。

### 下单计价与快照（order-biz，app-api）

- 下单/加购请求：商品行增加 `specUnique`（规格 SKU）+ `optionSelections:[{groupId,optionId,quantity}]`（小料 quantity≥1，属性 quantity 恒为 1）。
- 服务端实时计价：`price = 规格SKU.price + Σ(小料.price × quantity)`；不信任前端金额。
- 校验：必选组已选且 ≥ `minSelect`；多选组 ≤ `maxSelect`；单小料 ≤ `maxQuantity`；规格 SKU 与小料库存充足；小料 `status` 可用。
- 错误语义：库存不足、必选缺失、超限购、小料下架均返回明确业务错误码。
- 幂等：下单沿用现有下单幂等机制；库存扣减在同一事务内原子完成。

## DB

升级脚本：`backend/sql/upgrade-2026-07-17-product-option-pricing.sql`，含回滚语句。所有新表含 `tenant_id`、`create_time`、`update_time`、`deleted`。

- `yshop_store_product` 新增列 `has_options` tinyint(1) NOT NULL DEFAULT 0（是否启用选项加价）。存量默认 0，行为不变。
- 新增 `yshop_store_topping`（门店小料库）：`id,tenant_id,shop_id,name,price,stock,status,sort` + 标准字段；索引 `(tenant_id,shop_id)`。
- 新增 `yshop_product_option_group`：`id,tenant_id,product_id,group_type,name,required,multiple,min_select,max_select,default_option_id,sort` + 标准字段；索引 `(tenant_id,product_id)`。
- 新增 `yshop_product_option`：`id,tenant_id,group_id,name,is_default,sort,topping_id,max_quantity` + 标准字段；索引 `(tenant_id,group_id)`、`(topping_id)`。
  - 属性选项：`topping_id` 为空，仅 `name,is_default,sort`（无价格/库存列）。
  - 小料选项：`name` 冗余自小料（快照用），价格/库存实时取 `yshop_store_topping`，不冗余存储。
- `yshop_store_order_cart_info` 新增列：`option_snapshot` json NULL（所选规格 + 各组选项 + 小料份数 + 单价/加价明细）、`option_total_delta` decimal(10,2) NOT NULL DEFAULT 0（小料加价合计）。
- 回滚：DROP 三张新表；`ALTER TABLE ... DROP COLUMN has_options / option_snapshot / option_total_delta`。

## MQ

N/A：不新增 topic；库存扣减在下单事务内同步完成。

## 权限与数据范围

- 不新增权限点，全部复用商品权限（现有编码前缀为 `shop:store-product:*`）：
  - 小料库查询/管理复用 `shop:store-product:query` / `shop:store-product:create` / `shop:store-product:update` / `shop:store-product:delete`。
  - 选项组随商品保存，复用 `shop:store-product:update`。
- 数据范围：小料按 `shop_id` 限定门店范围；选项组按商品所属门店/部门范围；均含 `tenant_id` 由 MyBatis Plus 自动隔离。

## 依赖

- 不新增 Maven/前端第三方依赖。
- 模块间：`order-biz → product-api`（选项组/小料只读 + 计价 + 库存扣减）。小料库与选项组同处 product 模块，商品详情聚合与下单计价不跨模块读小料，仅经 `product-api`。

## 外部系统

N/A：不涉及外部系统变更。

## ADR

需新增 ADR：商品「基础规格 + 选项加价」定价模型（记录为何不扩 `spec_type`、属性不加价不加库存、小料门店共享单一事实源）。待用户确认设计后创建。
