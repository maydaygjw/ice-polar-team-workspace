# 店铺导入契约变更

## API

- `GET /admin-api/product/import/templates`：查询内置解析器和已上传模板；已上传模板返回文件名、文件大小和是否可下载。
- `POST /admin-api/product/import/template/upload`：上传导入模板文件并登记模板编码、名称、版本、解析器编码和说明；文件通过 infra-api 保存到主 OSS。
- `GET /admin-api/product/import/template-download?code=meituan-user`：返回已登记模板的 OSS 文件访问地址，不再动态生成 Excel。
- `POST /admin-api/product/import/preview`：上传文件并生成预览批次，参数包含模板编码、商圈和新店信息；不接收店铺公告或商品数据选项。
- `GET /admin-api/product/import/preview?id=`：恢复仍处于草稿状态的批次，返回店铺默认值和已保存的导入明细，管理端可继续编辑售价并调用确认接口导入；已导入状态不可恢复。
- `POST /admin-api/product/import/draft`：保存仍处于草稿状态的批次；请求体包含 `id`、`selectedItemIds` 和可选的 `items`，其中每项为 `{ id, price, productName?, firstCategory? }`；草稿保存选择状态、预览阶段调整后的售价、商品名称和一级分类，不改变批次状态。
- `POST /admin-api/product/import/confirm`：确认预览批次并执行导入；请求体包含 `id`、`selectedItemIds` 和可选的 `items`，其中每项为 `{ id, price, productName?, firstCategory? }`，未选中的有效明细标记为 `SKIPPED` 且不创建商品；同一预览只能成功确认一次。
- `GET /admin-api/product/import/page`：分页查询导入记录。
- `GET /admin-api/product/import/get?id=`：查询批次摘要和统计。
- `GET /admin-api/product/import/detail-page?batchId=`：分页查询行明细。
- `DELETE /admin-api/product/import/delete-data?id=`：删除任意状态的导入批次及明细；只删除 import 数据，不删除店铺、商品或分类。

成功响应使用现有 `{code: 0, data, msg}` 结构。批次状态对管理端只返回 `DRAFT`（草稿）和 `IMPORTED`（已导入）；明细仍保留待导入、已导入、跳过和失败等行级结果。模板编码和解析器校验、文件格式/大小、商圈状态和批次状态错误返回明确业务错误；重复确认返回原批次结果，不重复写入。

菜单展示名称为“门店中心 / 店铺导入”。为避免影响已接入的管理端和权限数据，当前 API 路径与权限编码仍保留 `product/import`、`product:import:*` 内部命名。

模板上传的 multipart 字段：`file`、`code`、`name`、`version`、`parserCode`、`description`。模板编码在当前租户内唯一，文件仅支持 `.xlsx`/`.xls`，大小不超过 10MB。

店铺导入预览的 multipart 字段不包含店铺手机号、店铺公告和数据选项；店铺图片通过素材选择组件提交 `image`，确认时未设置手机号按空字符串创建，店铺公告使用门店表默认值，商品默认不使用源文件月售且不立即上架。

## DB

- 新增 `yshop_product_import_batch`：模板、文件、商圈、店铺、批次状态、统计、是否新建店铺、操作人和时间。
- 新增 `yshop_product_import_item`：批次、源行号、外部商品 ID、规格、规范化数据、目标商品、行状态、错误和警告。
- 新增 `yshop_product_import_template`：模板编码、版本、解析器编码、原文件名、OSS 文件地址和文件元数据。
- `yshop_product_import_batch.shop_id` 保存本批次创建的店铺 ID。
- `yshop_product_import_item` 保存外部商品 ID/分组键/门店 ID/规格/属性规格 JSON、目标商品 ID、一级/最终分类 ID，以及分类是否由本批次创建。
- `yshop_store_shop`、`yshop_store_product`、`yshop_store_product_category` 不增加导入字段，避免对核心业务表产生侵入。
- 所有新增导入业务表包含租户字段；批次、目标商品 ID 和来源字段建立必要索引。

迁移文件：`backend/sql/upgrade-2026-07-15-product-import.sql`，提供对应回滚语句。

## 权限与数据范围

- `product:import:query`、`product:import:preview`、`product:import:create`、`product:import:delete`。
- `product:import:template:upload`。
- 模板列表和下载复用 `product:import:query`；上传使用 `product:import:template:upload`。
- 只能选择当前租户可见且启用的商圈；店铺和批次查询遵循现有租户/部门/门店范围。

## 依赖

- 新增跨模块能力通过 `store-api` 和 `product-api` 暴露，不让店铺导入模块依赖门店或商品实现类。
- `store-api` 新增导入专用的商圈默认值、创建店铺和最小店铺信息 DTO；商品域不直接读取店铺表。
- 预览响应返回 `selectedItemIds`；新建预览默认选中全部 `PENDING` 明细，确认和草稿接口均以 `selectedItemIds` 为导入范围。
- `product-api` 新增 `ProductImportWriteApi` 及商品/ SKU DTO；商品域只负责商品、分类、属性的写入，不提供导入删除能力。
- 不新增 MQ 或外部系统依赖；首期在请求内完成受限批次导入。
