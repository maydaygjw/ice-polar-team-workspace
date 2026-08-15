# 测试计划：手工触发应收应付结算

| 编号 | 场景 | 期望 |
|---|---|---|
| UNIT-01 | 配送回调推进到状态 2 | 只更新订单状态，不调用分账服务。 |
| UNIT-02 | 确认收货 | 只调用 `calculate`，不调用 `executeAdapay`。 |
| UNIT-03 | 成功应收应付手工结算 | 创建/复用分账记录并执行一次。 |
| UNIT-04 | 重复结算 | 不重复调用已完成的外部分账。 |
| UNIT-05 | 失败或非 Adapay 记录 | 不执行分账，返回失败。 |
| API-01 | 跨租户记录 ID | 无法结算当前租户之外的记录。 |
| UI-01 | 列表按钮状态 | 可结算记录可点击，其余记录禁用并显示状态。 |

## Commands

- `(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz,yshop-module-pay/yshop-module-pay-biz -am test)`
- `(cd admin && pnpm ts:check)`
- `(cd admin && pnpm build:prod)`
