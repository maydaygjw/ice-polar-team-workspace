# Change Report

## Business result

- 店铺导入界面新增“美团镜像库”来源。
- 选择该来源时只填写 `poi_id`，不需要上传 Excel 模板或文件。
- 导入商品、SKU 规格和商品级选项，不导入评论。
- `15402787971` 样例的多 SKU 与 SKU 属性可精确落到系统规格；绑定到 SKU 的“小料自由（超值搭配）”等用户选项不再误落为规格，选项的规则、价格、默认值和状态被保留。

## Repositories

- `backend`：新增镜像库只读访问、解析器、批次来源字段、选项元数据写入、配置占位符和数据库迁移。
- `admin`：新增来源选择、POI 输入、条件校验、批次展示和筛选。

## Contracts

- 预览 multipart 请求增加 `sourceType` 与 `poiId`。
- 批次响应和分页过滤增加 `sourceType`、`sourcePoiId`。
- 商品导入选项 DTO 增加选择范围及选项价格/默认/状态元数据。

## Migration

- 执行 `backend/sql/upgrade-2026-08-09-meituan-mirror-import.sql`。
- 连接地址、账号和密码通过 `YSHOP_PRODUCT_IMPORT_MEITUAN_MIRROR_*` 环境变量注入。

## Verification

- Backend compile：pass。
- Backend targeted tests：8 tests pass across parser/service/writer tests。
- Admin production build：pass。
- Admin full type check：baseline generated declaration errors，not a feature-specific failure。

## Residual risks

- 需要部署环境注入镜像库配置并在真实环境执行一次预览/确认。
- 未新增自动同步任务；当前为按 POI 手动导入。

## Suggested PR

`feat(store-import): support Meituan mirror product import`
