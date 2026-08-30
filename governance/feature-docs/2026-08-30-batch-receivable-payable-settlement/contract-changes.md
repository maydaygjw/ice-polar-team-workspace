# 契约变更：应收应付批量结算

## 管理端 API

### `POST /admin-api/pay/receivable-payable/batch-settle`

权限：`pay:receivable-payable:settle`

请求体：

```json
{
  "ids": [101, 102]
}
```

`ids` 必填，最多 100 个应收应付主记录 ID。租户从当前登录上下文解析，客户端不得传入租户 ID、订单 ID 或支付 ID。

响应 `data`：

```json
{
  "total": 2,
  "successCount": 1,
  "failedCount": 1,
  "results": [
    {"id": 101, "success": true, "message": "结算成功"},
    {"id": 102, "success": false, "message": "当前记录不满足结算条件或分账失败"}
  ]
}
```

服务端对 ID 去重后逐条调用既有结算状态机；单项失败不回滚或阻断其他项。已成功或幂等完成的记录返回 `success=true`。

## 兼容性

- 既有 `POST /admin-api/pay/receivable-payable/settle?id={id}` 保持不变。
- 不新增数据库表、字段、MQ 事件或外部 AdaPay 接口。
