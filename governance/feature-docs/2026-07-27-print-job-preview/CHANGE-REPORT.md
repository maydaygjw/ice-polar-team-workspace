# 打印任务预览 - CHANGE REPORT

## 业务结果

管理后台「打印任务」页新增「新建打印任务」入口，提供**打印预览**：选店铺、上传 PDF/Word、选纸张/颜色/份数后，返回文件页数与计价（基础价/Option 加价/应付总额）。**本期不真实打印**——不提交链科、不创建订单/设备订单、不产生 taskId，确认即关闭，不留记录。

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

- `mvn -pl yshop-server -am package -DskipTests`: pass
- `pnpm build:prod`: pass
- `vue-tsc --noEmit`（printJob 相关）: pass
- 单测：编译通过；本机 Mockito 环境限制未运行通过（基线同病），建议 CI 补跑

## 残余风险

- 预览价源取店铺文件打印类目首个有效商品（K1）；Option 未命中按 0 计价（K2）。详见 review-report.md。

## 建议 PR

**标题**：`feat(printer): 打印任务预览（不真实打印）+ product Option API 去打印语义化`

**正文**：见 PR（含 Summary / Contracts / Verification / Risks / Migration）。

## 交付动作

- backend / admin 分支 `feat/print-job-preview` 已 push 至 Gitee，走 PR review 后合并。
