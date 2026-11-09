# 契约变更：外卖订单应收应付状态与手工生成

见 [`governance/CONTRACTS.md`](../../CONTRACTS.md)「外卖订单应收应付状态与手工生成」章节。

- 管理端订单分页响应新增只读 `receivablePayableGenerated` 布尔字段。
- `POST /admin-api/order/store-order/generate-receivable-payable?id={storeOrderId}` 使用 `order:store-order:update` 权限并返回布尔结果。
- 订单模块内部 `OrderApi` 暴露按租户和订单号更新状态标记的能力；pay 模块计费结果驱动该字段，不新增管理端状态查询接口。
- 订单表新增 `receivable_payable_generated` 冗余字段，历史成功记录由迁移回填。
