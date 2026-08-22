# 打印任务预览 - CHANGE REPORT

## 业务结果

管理后台「打印任务」页新增「新建打印任务」入口，提供**打印文件预览图**：选店铺、上传文件、选纸张/颜色/份数后，提交异步预览任务并展示文件图片。**本期预览不计算页数、不计价、不真实打印**——不创建订单/设备订单；页数和价格由独立计价接口负责。

顺带完成 product 域重构：`ProductApi.regenerateProductOptions` 去除打印语义，「纸张/颜色」概念收回 device 调用方。

## 影响仓库

- `backend`（yshop-drink）：预览接口 + product API 重构 + 菜单 SQL
- `admin`（yshop-drink-vue）：预览弹窗 + 列表页按钮 + API

## 契约 / 迁移

- 新增 `POST /admin-api/device/print-job/preview`（权限 `device:print-job:create`），不真实打印、不落库。
- `ProductApi.regenerateProductOptions` 签名变更：`(shopId, paperNames, colorNames, categoryNames)` → `(shopId, List<ProductOptionGroupSpecDTO>, categoryNames)`。
- `ProductOptionOrderApi` 新增 `priceAndValidateByNames(productId, groupName, optionName)`。
- DB：无表结构变更；菜单 SQL `sql/upgrade-2026-07-27-print-job-preview.sql`（幂等，部署前需执行）。

## 验证结果

- `mvn -pl yshop-module-device/yshop-module-device-biz-print -am -Dtest=PrintJobPreviewServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass
- `pnpm build:prod`: pass
- `pnpm ts:check`：打印任务相关文件无错误；存在既有 `printJob/index.vue` 类型错误

## 残余风险

- 页数/计价仍取店铺文件打印类目首个有效商品（K1）；Option 未命中按 0 计价（K2），仅影响独立计价接口。详见 review-report.md。

## 建议 PR

**标题**：`feat(printer): 打印任务预览（不真实打印）+ product Option API 去打印语义化`

**正文**：见 PR（含 Summary / Contracts / Verification / Risks / Migration）。

## 交付动作

- backend / admin 分支 `feat/print-job-preview` 已 push 至 Gitee，走 PR review 后合并。
