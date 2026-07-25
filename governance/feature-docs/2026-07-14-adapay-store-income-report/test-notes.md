# Test Notes — Adapay 店铺收入报表

## 本次功能验证

| 命令 | 结果 | 说明 |
|------|------|------|
| `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests compile)` | 通过 | 新增 Controller、Service、Mapper、VO 和 XML 编译通过 |
| `(cd admin && pnpm exec eslint src/api/mall/store/profitSharingIncome/index.ts src/views/mall/store/profitSharingIncome/index.vue)` | 通过 | 新增前端 API 与页面无 ESLint 错误 |
| `xmllint --noout .../ProfitSharingIncomeMapper.xml` | 通过 | Mapper XML 结构合法 |
| `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz test)` | 未通过 | 现有 OCR 类型缺失、对账枚举类缺失导致 16 个既有测试错误；未触及本功能测试 |
| `(cd admin && pnpm ts:check)` | 未通过 | 工作区既有 TypeScript `types` 配置引用的类型定义无法解析，未进入业务类型检查 |

## 未执行

- 未连接测试数据库，未执行真实 SQL 聚合、租户/店铺权限和分页结果验证。
- 未执行 Playwright E2E；当前 feature meta 将 `e2e` 设为 false，页面只读且依赖已有登录/菜单环境。

## 重点手工用例

1. 同一店铺同一结算日存在成功分账：汇总收入等于店铺角色明细之和。
2. 同日存在平台、店铺、配送方、销售方明细：只累计店铺角色金额。
3. 待分账、分账中、失败、已回退记录：不出现在 Adapay 收入汇总和明细中。
4. 非管理员传入无权店铺 ID：汇总为空，明细不可读取其他店铺数据。
5. 结算时间跨日边界：以 `sharing_time` 的 `Asia/Shanghai` 自然日归组，结束日期不包含次日数据。
