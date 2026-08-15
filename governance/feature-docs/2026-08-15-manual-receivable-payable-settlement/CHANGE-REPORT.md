# 变更报告：手工触发应收应付结算

## 业务结果

- 配送回调和订单状态更新不再触发 AdaPay 分账。
- 用户确认收货只生成通用应收应付事实；财务可在应收应付管理页逐单点击“结算”。
- 设备订单管理页对已支付且业务状态为 `1` 的订单提供“确认收货”，复用既有订单收货接口。
- 日终任务改为查询成功应收应付记录作为新订单分账来源。

## 受影响仓库

- `backend`：调整订单状态路径、计费结算内部 API、日终 Job、应收应付管理接口和权限升级 SQL；补充定向单元测试。
- `admin`：应收应付列表增加分账状态、分页和“结算”按钮；保留失败重算入口的数据契约。
- `governance`：记录需求、契约、技术设计、测试和审查结果。

## 契约变化

- 新增 `POST /admin-api/pay/receivable-payable/settle?id={id}`。
- 新增权限 `pay:receivable-payable:settle`。
- `BillingSettlementApi` 改为按应收应付记录 ID 提供 `settle`、日终待处理查询和回退能力。

## 验证结果

- 后端跳过测试编译、两个直接相关定向测试通过。
- 管理端 `pnpm ts:check` 和 `pnpm build:prod` 通过。
- 全量相关模块测试存在两组既有失败，详见 `test-notes.md`，不属于本次变更引入。

## 建议提交标题

`feat(pay): separate receivable-payable calculation from settlement`
