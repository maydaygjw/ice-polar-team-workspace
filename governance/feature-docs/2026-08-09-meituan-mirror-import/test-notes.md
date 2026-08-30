# 美团镜像库店铺导入测试记录

## 计划

- 解析器单元测试：单 SKU、多 SKU、SKU 级属性、商品级选项、默认值、加价、必选/多选规则。
- 数据异常测试：不存在的 `poi_id`、无商品、缺分类、缺 SKU 属性、重复 SKU、价格不一致和查询超时。
- API 测试：文件模式兼容、镜像模式条件校验、权限、租户隔离、重复确认和失败不创建店铺。
- 管理端检查：切换来源时模板/文件控件显隐，`poi_id` 校验，预览来源展示和批次列表展示。

## 已知基准数据

- `spu_id=15402787971`：3 个 `foods` SKU、3 个 SKU 级 `food_attrs` 记录，规格值和价格可一一对应；商品级选项组包括加量、口味、温馨提示。
- `poi_id=RAnuN-5nDfUcn94ct_m0igI`、`spu_id=26390657803`：`份量` 与 `小料自由（超值搭配）` 均带 `sku_id`；后者的同一 `attr_id` 在该门店其他商品中也存在空 `sku_id` 记录，因此保留为带差异加价的商品选项组。
- `spu_id=26388918289`：`foods.spec_text` 为空，但 SKU 规格值保存在 `food_attrs`；导入行 `sourceSpec` 应回填为“小份（6个鸡块+6个年糕）”和“大份（12个鸡块+12个年糕）”，不能显示“默认”。

## 执行结果

- `mvn -pl yshop-module-mall/yshop-module-store-import-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-mall/yshop-module-store-import-biz -am -Dtest=ProductImportServiceImplTest,MeituanMirrorProductImportParserTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，7 tests。
- `mvn -pl yshop-module-mall/yshop-module-product-biz -am -Dtest=ProductImportWriteApiImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，1 test。
- `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`：未通过，当前仓库基线缺少自动导入生成声明，产生大量既有全局类型错误；未发现该导入页面的专属错误输出。
- `pnpm build:prod`：通过。
- 针对 `15402787971` 的回归样例验证 3 个 SKU 均能通过 `sku_id` 找到唯一 `份量` 属性，且 `加量/口味/温馨提示` 商品选项组的选择规则和选项元数据被保留。
- 镜像库读取 SQL 未包含 `comments` 或评论相关表；评论不会进入导入批次。
- 测试环境只读抽样确认上述披萨商品的属性类型与回归测试样例一致；未执行任何镜像库写操作。

本文件不记录数据库密码、完整图片 URL 或评论内容。
