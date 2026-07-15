# 店铺导入契约变更

## API

- `GET /admin-api/product/import/templates`：查询内置解析器和已上传模板；已上传模板返回文件名、文件大小和是否可下载。
- `POST /admin-api/product/import/template/upload`：上传导入模板文件并登记模板编码、名称、版本、解析器编码和说明；文件通过 infra-api 保存到主 OSS。
- `GET /admin-api/product/import/template-download?code=meituan-user`：返回已登记模板的 OSS 文件访问地址，不再动态生成 Excel。
- `POST /admin-api/product/import/preview`：上传文件并生成预览批次，参数包含模板编码、商圈、新店信息和导入选项。
- `POST /admin-api/product/import/confirm`：确认预览批次并执行导入；同一预览只能成功确认一次。
- `GET /admin-api/product/import/page`：分页查询导入记录。
- `GET /admin-api/product/import/get?id=`：查询批次摘要和统计。
- `GET /admin-api/product/import/detail-page?batchId=`：分页查询行明细。
- `DELETE /admin-api/product/import/delete-data?id=`：删除本批次店铺商品数据。
- `DELETE /admin-api/product/import/delete-shop?id=`：删除本批次创建的店铺及本批次数据。

成功响应使用现有 `{code: 0, data, msg}` 结构。模板编码和解析器校验、文件格式/大小、商圈状态、批次状态和删除条件错误返回明确业务错误；重复确认返回原批次结果，不重复写入。

菜单展示名称为“门店中心 / 店铺导入”。为避免影响已接入的管理端和权限数据，当前 API 路径与权限编码仍保留 `product/import`、`product:import:*` 内部命名。

模板上传的 multipart 字段：`file`、`code`、`name`、`version`、`parserCode`、`description`。模板编码在当前租户内唯一，文件仅支持 `.xlsx`/`.xls`，大小不超过 10MB。

## DB

- 新增 `yshop_product_import_batch`：模板、文件、商圈、店铺、批次状态、统计、是否新建店铺、操作人和时间。
- 新增 `yshop_product_import_item`：批次、源行号、外部商品 ID、规格、规范化数据、目标商品、行状态、错误和警告。
- 新增 `yshop_product_import_template`：模板编码、版本、解析器编码、原文件名、OSS 文件地址和文件元数据。
- `yshop_store_shop` 增加可空 `import_batch_id`。
- `yshop_store_product` 增加可空 `import_batch_id`、`import_source`、`source_product_id`、`source_spec`。
- `yshop_store_product_category` 增加可空 `import_batch_id`。
- 所有新增业务表包含租户字段；批次、店铺、商品和明细建立必要索引。

迁移文件：`backend/sql/upgrade-2026-07-15-product-import.sql`，提供对应回滚语句。

## 权限与数据范围

- `product:import:query`、`product:import:preview`、`product:import:create`、`product:import:delete`、`product:import:delete-shop`。
- `product:import:template:upload`。
- 模板列表和下载复用 `product:import:query`；上传使用 `product:import:template:upload`。
- 只能选择当前租户可见且启用的商圈；店铺和批次查询遵循现有租户/部门/门店范围。

## 依赖

- 新增跨模块能力通过 `store-api` 和 `product-api` 暴露，不让店铺导入模块依赖门店或商品实现类。
- `store-api` 新增导入专用的商圈默认值、创建店铺和最小店铺信息 DTO；商品域不直接读取店铺表。
- `product-api` 新增 `ProductImportWriteApi` 及商品/ SKU DTO；商品域负责商品、分类、属性的写入和按批次清理。
- 不新增 MQ 或外部系统依赖；首期在请求内完成受限批次导入。
