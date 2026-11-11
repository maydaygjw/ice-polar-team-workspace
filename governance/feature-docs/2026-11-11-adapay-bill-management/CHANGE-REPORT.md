# 变更报告 — AdaPay 对账单管理

## 业务结果

管理后台新增“对账单管理”。管理员可按历史日期手动下载 AdaPay 标准账单 ZIP，日历展示已下载、下载中、失败和未下载状态；页面分页展示 Charge、PaymentConfirm、Div 原始字段，并支持按各账单类型字段筛选，并按支付ID关联本地订单展示商家名称；日历支持折叠，明细表格使用 vuex-table。每次成功下载保留 ZIP 版本，解析明细按日期删除重建；失败不会破坏上一次成功数据。

## 影响仓库

- `backend`
  - 新增 `pay-biz` 对账单管理 Controller、Service、异步执行器、CSV 解析器和三类明细 Mapper。
  - 新增 `yshop-module-infra-api` 依赖，通过 `FileApi` 使用主 OSS。
  - 新增 `V2026111102__adapay_bill_management.sql`、`V2026111103__adapay_bill_detail_shop_snapshot.sql`（明细表冗余 `shop_id`、`shop_name`，导入时填充）。
  - 新增 8 个错误码。
- `admin`
  - 新增 `/pay/adapay-bill` API client。
  - 新增 `mall/store/adapayBill/index.vue` 页面。
- `governance`
  - 新增需求、技术设计、契约、UI/UX、测试、Review 和变更报告。
  - 更新 `CONTRACTS.md` 索引。

## 契约

- 新增 9 个管理端接口，路径前缀 `/admin-api/pay/adapay-bill`。
- 新增权限 `pay:adapay-bill:query`、`pay:adapay-bill:download`。
- 新增 4 张表：下载记录、Charge 明细、PaymentConfirm 明细、Div 明细。
- 明细重拉按租户和账单日期物理删除后重建；ZIP 版本不删除。
- 不修改现有“日终对账记录”模块、订单、支付或分账表。

## 验证

- `mvn -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-pay/yshop-module-pay-biz -am -Dtest=AdapayBillCsvParserTest,AdapayBillDetailMapperXmlTest -Dsurefire.failIfNoSpecifiedTests=false test`：5 项通过。
- `mvn -pl yshop-server -am -DskipTests package`：通过。
- `pnpm ts:check` 筛选新增路径：无错误。
- `pnpm build:prod`：通过。
- 全量 `pay-biz` 测试仍有 3 个既有 `BillingSettlementServiceImplTest` 失败。

## 残余风险

- 未调用真实 AdaPay，未验证线上 ZIP 响应。
- 未连接真实 OSS，未验证上传和回读。
- 未执行数据库迁移和菜单初始化。
- 未完成登录态 E2E。

## 建议 PR 标题

`feat(pay): 增加 AdaPay 对账单管理`

## 建议 PR 描述

按天手动下载 AdaPay 标准账单 ZIP，归档到主 OSS；解析 Charge、PaymentConfirm、Div 三类 CSV 并分页展示，支持 Div MemberId 筛选、日历状态和成功重拉后的明细原子替换。

验证：后端编译、目标单测和 `yshop-server` 打包通过；管理端新增文件类型检查和 `build:prod` 通过。真实 AdaPay、OSS、数据库迁移和登录态 E2E 尚未执行。
