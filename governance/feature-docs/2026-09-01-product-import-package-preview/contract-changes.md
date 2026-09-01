# 美团镜像库店铺导入套餐标识契约变更

## API

- `POST /admin-api/product/import/preview`、`GET /admin-api/product/import/preview?id=` 和导入明细接口返回明细字段 `isPackage`。
- `isPackage` 来源于美团镜像库 `food_spus.is_package`，取值 `0`（否）或 `1`（是）；文件导入数据兼容返回 `0`。
- 管理端导入预览按 `isPackage` 提供“否/是”筛选，不改变确认导入请求语义。

## DB

- `yshop_product_import_item` 增加 `is_package` tinyint(1) NOT NULL DEFAULT 0，用于保存预览快照并支持导入明细查询。
- 迁移文件：`backend/sql/upgrade-2026-09-01-product-import-package.sql`，包含回滚语句。

## 外部系统

- 美团镜像库只读查询 `food_spus.is_package`；不新增写入或权限边界。
