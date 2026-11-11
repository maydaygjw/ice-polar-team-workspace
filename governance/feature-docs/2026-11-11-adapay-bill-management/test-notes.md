# 验证记录 — AdaPay 对账单管理

## 已执行

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端编译 | `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests compile)` | 通过 |
| 新增单测 | `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz -am -Dtest=AdapayBillCsvParserTest,AdapayBillDetailMapperXmlTest -Dsurefire.failIfNoSpecifiedTests=false test)` | 5 项通过 |
| 后端应用打包 | `(cd backend && mvn -pl yshop-server -am -DskipTests package)` | 通过，生成 `yshop-server.jar` |
| 管理端新增文件类型检查 | `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`，筛选 `adapayBill` 相关路径 | 新增文件无类型错误 |
| 管理端生产构建 | `(cd admin && NODE_OPTIONS=--max-old-space-size=8192 pnpm build:prod)` | 通过 |

新增单测覆盖：

- CSV 注释行过滤、带引号字段、扩展列和原始行号。
- 只有表头、没有业务数据时返回空明细。
- 缺少必需表头时失败。
- 数据行列数不足时失败。
- 三个 Mapper XML 的物理删除语句包含租户和账单日期条件。

## 未通过或未执行

- `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz -am test)` 未通过。失败项为既有 `BillingSettlementServiceImplTest` 的 2 个断言和 1 个 Mockito unnecessary stubbing，与本次新增包无关；本次新增 5 项测试均通过。
- 全量 `pnpm ts:check` 仍返回仓库既有类型错误；筛选 `adapayBill`、`pay/adapayBill` 无输出，说明新增文件未引入类型错误。
- 未连接真实 AdaPay 下载账单，未验证远端实际响应和 ZIP 文件命名。
- 未连接真实主 OSS，未验证上传、回读和 URL 有效性。
- 未执行 Flyway migration，未在真实 MySQL 验证四张表、索引、角色菜单和租户套餐更新。
- 未完成登录态下的浏览器 E2E；前端只完成类型检查和生产构建。
