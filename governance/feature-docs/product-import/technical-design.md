# 店铺导入技术设计

## 模块影响

- `backend`：新增独立的 `yshop-module-store-import-biz`，承载导入模板元数据、OSS 文件登记、模板解析、预览、导入和清理能力；通过窄化的门店 API 创建带商圈默认值的新店铺。
- `yshop-module-product-biz`：只保留商品、分类、SKU 和属性等核心能力；通过商品导入写入 API 为导入模块提供批量创建/清理商品能力，不承载导入流程编排。
- `admin`：增加独立导入页面、模板管理弹窗、API client、路由和菜单契约。
- `sql`：只新增导入模板、批次/明细表；店铺、商品、分类原表不增加导入字段，目标 ID 和来源信息全部保存在导入模块表中。

## 关键决策

1. 导入编排放在独立的店铺导入模块，首期不提供已有店铺模式；店铺域只暴露“按商圈创建导入店铺”的窄接口，避免导入模块依赖门店实现细节。
2. 模板文件通过 `infra-api` 的 `FileApi.createFile` 保存到主 OSS，店铺导入模块只保存文件 URL、原文件名和元数据，不直接依赖 OSS SDK。
3. 模板通过 `ProductImportTemplateParser` 适配器注册；模板元数据保存 `parserCode`，导入时以模板编码查元数据，再委托对应解析器。`meituan-user`（版本 v1）读取美团外卖用户端导出文件，`meituan-merchant`（版本 v1）读取美团商家版 `门店商品` Sheet。
4. 模板编码在租户内唯一；一个解析器可以对应多个上传模板，便于保存不同平台导出版本。新增平台格式必须先增加解析器实现。
5. 下载接口只查询模板元数据并返回 OSS URL，前端直接打开静态文件，不调用 `ExcelUtils.write` 动态生成。
6. 预览结果落入服务端临时批次，确认时重新校验并生成正式导入批次；确认接口必须幂等。
7. 导入写入以批次为边界，成功、跳过、失败行均保存明细；删除从导入明细反向收集店铺、商品和分类 ID，再按目标 ID 清理。
8. 商品确认时以“非空外部商品 ID + 一级/二级分类”作为商品身份；同一分类下的不同规格合并到同一个商品并创建多个 SKU，跨分类时创建商品副本。
9. 首期图片只保存源 URL，主解析 Sheet 图片为空时由对应 parser 从同一文件的“商品详情”Sheet 的“图片链接”字段补充，避免在导入事务中引入外部图片下载失败和超时。
10. 店铺名称由对应 parser 从源文件名提取，框架只消费 parser 返回值，不按平台格式硬编码文件名规则。
11. 美团商家版以“分类 + 商品名称”合并商品，`规格名称`为可差异定价的规格组，`属性`按 `##` 拆分规格组、按 `#` 拆分选项；同一商品属性结构不一致或同一规格价格不一致时，只标记相关行错误并保留预览。

## Maven 模块边界

`yshop-module-store-import-biz` 放在 `backend/yshop-module-mall/` 下，并加入 `yshop-module-mall/pom.xml` 聚合。首期不单独创建 API module，因为能力只供管理端 HTTP 接口使用；后续若有异步导入或其他模块调用，再增加 `yshop-module-store-import-api`。

模块迁移范围：

- 迁移 `controller/admin/productimport`、导入 VO、导入 Service、模板解析器、导入批次/明细/模板 DO、Mapper 和导入状态枚举。
- `product-biz` 保留商品核心 DO、分类/商品/属性服务及其实现；导入模块通过 `product-api` 新增的导入写入 DTO/API 调用商品能力。
- 导入模块直接依赖 `store-api`、`product-api`、`order-api`、`infra-api` 和 Web/MyBatis/Excel starters，不直接依赖 `store-biz` 或商品表；商品模块通过 API 返回创建结果和执行目标 ID 清理。
- `yshop-server` 增加 `yshop-module-store-import-biz` 依赖；原 `product-biz` 中的导入 Controller/Service 删除，避免 Bean 重复注册。

拆分已完成：`product-api` 的商品导入写入契约由 `product-biz` 实现，导入代码已移动到新模块，`yshop-server` 已接入新依赖。API 路径、权限编码、数据库表名和前端路由保持不变。

## 流程

```text
模板元数据 + Excel 文件 → 主 OSS
        ↓
选择模板 + 上传导入文件 + 商圈 + 新店参数
        ↓
模板编码 → parserCode → 模板适配器解析 → 规范化行 → 校验/去重 → 预览批次
        ↓ 确认
创建新店铺(商圈默认值) → 创建分类 → 创建商品/SKU → 更新批次统计
        ↓
导入记录 / 明细 / 按批次清理
```

## 模板管理接口

- `GET /product/import/templates`：返回内置解析器和已上传模板；已上传模板包含 OSS 文件信息。
- `POST /product/import/template/upload`：接收模板编码、名称、版本、解析器编码、说明和 `.xlsx`/`.xls` 文件，文件上限 10MB。
- `GET /product/import/template-download?code=...`：校验模板编码并返回 OSS 文件 URL。

内置解析器可以在没有模板元数据时继续用于导入，但没有已上传文件时不提供下载按钮。上传同一解析器的新文件时使用新的模板编码，例如 `meituan-user-v2`。

管理端菜单名称为“店铺导入”，接口内部仍使用 `/product/import`，这是兼容性命名，不代表该功能归属于商品菜单。

## 风险与回滚

- 迁移只新增表和可空字段，回滚删除新增字段/表；已导入业务数据回滚使用批次清理接口。
- 店铺存在订单或批次外商品时阻止整店删除，避免破坏历史业务。
- 解析和写入限制文件大小、行数和图片 URL 长度；所有查询带租户和管理端数据权限。
- OSS 上传成功但数据库登记失败时可能产生孤儿文件；后续可通过文件管理模块按 `yshop/product-import/templates/` 路径清理。
