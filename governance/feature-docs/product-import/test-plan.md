# 店铺导入测试计划

## 已完成验证

- 店铺导入模块编译：`mvn -pl yshop-module-mall/yshop-module-store-import-biz -am -DskipTests compile`。
- Server 聚合编译：`mvn -pl yshop-server -am -DskipTests compile`。
- 管理端构建：`pnpm build:dev`。
- 商品导入页面和 API client ESLint：`pnpm exec eslint src/views/mall/product/productImport/index.vue src/api/mall/product/productImport/index.ts`。
- 使用真实文件 `数据导出-莱运小笼·纯蟹粉蟹膏小笼（静安店）.xlsx` 验证解析：优先读取 `商品详情-多规格多行显示`，解析 85 行，首行商品名称为“蟹黄蟹粉鲜肉小笼（8只）”。

## 联调验收

1. 执行 `backend/sql/upgrade-2026-07-15-product-import.sql`，确认“门店中心 / 店铺导入”菜单、六个权限及 `yshop_product_import_template` 表出现。
2. 在“模板管理”上传 `美团外卖商品导入模板.xlsx`，编码填 `meituan-user`、解析器选择 `meituan-user`，确认模板记录和 OSS 地址保存成功。
3. 再上传一个不同编码的模板，例如 `meituan-user-v2`，确认模板列表可同时展示并可分别下载。
4. 下载模板，确认浏览器获得 OSS 中保存的原文件，后端日志中不调用动态 Excel 写出逻辑。
5. 选择启用商圈，确认预览页展示地址、营业时间、抽成、配送和省市区模板值。
6. 上传真实美团文件，确认分类、商品、规格、库存、价格和图片警告正确展示。
7. 确认导入，确认新建店铺、商品和分类均带有批次标记，默认下架。
8. 查询批次和明细，确认成功/失败统计可见；重复确认不能再次导入。
9. 执行“删除商品数据”，确认仅删除该批次商品、SKU 和分类，批次变为已删除。
10. 对无订单且无批次外商品的批次执行“删除店铺及商品”；对有订单或批次外商品的店铺确认操作被拒绝。

## 风险验证

- 上传缺少必需列、空文件、超过 10MB 文件。
- 上传非 Excel 文件、重复模板编码、未知解析器、OSS 配置不可用。
- 商圈不存在或已停用。
- 源文件商品 ID + 规格重复、规格包含 `#`、图片链接为空。
- 商品创建过程中单组失败时，批次应为部分成功且明细保留错误原因。
