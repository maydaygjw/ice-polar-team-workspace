# 测试记录：手工触发应收应付结算

## 已执行

| 检查 | 结果 |
|---|---|
| 后端跳过测试编译：`mvn -pl yshop-module-mall/yshop-module-order-biz,yshop-module-pay/yshop-module-pay-biz -am -DskipTests package` | 通过 |
| `OrderApiImplTest` | 通过，确认配送状态回调不触发分账 |
| `ProfitSharingSettlementJobTest` | 通过，确认日终任务从应收应付记录取数并调用统一结算入口 |
| `admin pnpm ts:check` | 通过 |
| `admin pnpm build:prod` | 通过；仅有项目既有 Sass 弃用警告 |

## 备注

按比例扩大范围运行后端测试时，发现两组与本次改动无关的既有失败：

- `YuePayServiceTest` 的 3 个用例因既有 `userBillApi` 未注入而 NPE；
- `ProfitRecipientServiceImplTest.testValidateMemberInfo_corpWithoutBankLicensePhotoUrl_ok` 断言失败。

本次新增和直接受影响的定向测试均通过；尚未执行真实 Adapay、数据库和浏览器端到端验证。
