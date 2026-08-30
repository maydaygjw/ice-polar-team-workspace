# 美团镜像库店铺导入契约变更

## API

- `POST /admin-api/product/import/preview` 继续复用；新增 `sourceType` 和 `poiId` multipart 字段。
- `sourceType=FILE`：保持现有行为，要求 `templateCode` 和 `file`。
- `sourceType=MEITUAN_MIRROR`：不要求 `templateCode` 和 `file`，要求非空 `poiId`；仍要求商圈和新店必要信息。
- `GET /admin-api/product/import/preview?id=`：返回来源类型和 `poiId`。
- `GET /admin-api/product/import/page`：批次响应返回来源类型和 `poiId`，文件导入保持兼容。
- 镜像库错误语义：数据源不可用、`poiId` 不存在、无商品、数据超限和源数据不一致分别返回明确业务错误；不创建店铺。

## DB

- `yshop_product_import_batch` 增加 `source_type`，默认 `FILE`，用于兼容历史批次。
- `yshop_product_import_batch` 增加可空 `source_poi_id varchar(128)`，镜像库批次保存 `poi_id`。
- 为来源类型和来源 `poi_id` 增加查询索引；字段只保存来源标识，不保存外部数据库凭据或商品原始 JSON 全量副本。
- 迁移文件：`backend/sql/upgrade-2026-08-09-meituan-mirror-import.sql`，包含回滚语句。

## 商品导入写入契约

- SKU 规格 DTO 保持现有价格、原价、库存、图片和 `details`；镜像解析器将未出现商品级形态的 `food_attrs` 转成规格组及每个 SKU 的详情。
- 选项组 DTO 增加最小/最大选择数语义和选项默认值；保留 `required`、`multiple`、`value_price`、`selected`、`sale_status`。
- `sku_id=''` 的属性不生成 SKU，不参与规格笛卡尔积；同一 `attr_id` 的用户可选属性即使带 `sku_id`，同样只生成商品选项组。

## 外部系统

- 外部系统：MySQL `mitmflows` 美团镜像库，当前版本按现有 `foods`、`food_attrs`、`food_categories` 表结构读取；`foods.forbid_single_buy=1` 表示单点不送，映射为导入字段 `isSingleNoDelivery=1`。
- 认证：服务端环境变量中的只读数据库账号；管理端只提交 `poi_id`。
- 访问：参数化只读 SQL；连接超时、读取超时和批次上限可配置；不访问评论表和采集流表。
- 幂等：外部查询无写入；本地批次沿用现有草稿/确认幂等规则。

## 权限与数据范围

- 复用现有 `product:import:preview`、`product:import:create`、`product:import:query`、`product:import:delete` 权限。
- 镜像数据写入使用当前租户上下文；外部 `poi_id` 不作为租户标识，不能绕过本地商圈、店铺和租户校验。
