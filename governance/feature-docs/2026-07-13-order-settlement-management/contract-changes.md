# 契约变更 — 订单结算管理

## API 契约

### 新增端点

#### `GET /order/store-order/settlement-page`

**模块**: `yshop-module-order-biz`  
**权限**: `order:settlement:query`
**说明**: 分页查询订单结算列表（订单表 LEFT JOIN 分账表）

请求 (`StoreOrderSettlementPageReqVO`):
```json
{
  "orderId": "string | null",
  "shopId": "long | null",
  "orderStatus": "int | null",
  "settlementStatus": "int | null",
  "payTimeStart": "datetime | null",
  "payTimeEnd": "datetime | null",
  "pageNo": "int",
  "pageSize": "int"
}
```

响应 (分页包裹 `StoreOrderSettlementRespVO`):
```json
{
  "id": "long",
  "orderId": "string",
  "shopId": "long",
  "shopName": "string",
  "payPrice": "decimal",
  "feeAmount": "decimal | null",
  "payType": "string",
  "orderStatus": "int",
  "payTime": "datetime | null",
  "createTime": "datetime",
  "profitSharingOrderId": "long | null",
  "settlementStatus": "int",
  "sharingTime": "datetime | null",
  "estimatedPaymentDate": "date | null"
}
```

`estimatedPaymentDate` 仅在分账成功且存在 `sharingTime` 时返回，按当前 AdaPay 结算策略计算；无预计日期时为 `null`。

同步订单分账状态时，后端同时读取 AdaPay 确认记录中的 `div_members[].fee_flag` 和支付确认级 `fee_amt`，分别更新承担方标记和实际手续费金额。详情在承担手续费的分账明细行展示 `feeAmount`；无远端手续费金额时为 `null`。拼单支付按各支付确认记录分别保存手续费金额，订单级明细显示已同步确认记录的手续费合计；各支付明细展示各自金额。

**settlementStatus 枚举**:
| 值 | 含义 |
|----|------|
| 0 | 未结算 |
| 1 | 待分账 |
| 2 | 分账中 |
| 3 | 已结算 |
| 4 | 分账失败 |
| 5 | 不适用（非 AdaPay 支付，不参与 AdaPay 分账） |

---

#### `GET /pay/profit-sharing-order/settlement-detail`

**模块**: `yshop-module-pay-biz`
**权限**: `order:settlement:query`
**说明**: 按订单号查询结算明细（含收款人银行卡脱敏信息）

请求:
```json
{
  "orderId": "string (required)"
}
```

响应 (`SettlementDetailRespVO`):
```json
{
  "orderId": "string",
  "shopId": "long",
  "shopName": "string",
  "payPrice": "decimal",
  "adapayPaymentId": "string",
  "adapayConfirmId": "string | null",
  "sharingTime": "datetime | null",
  "sharingStatus": "int",
  "calculationType": "int",
  "feeBearerRole": "int",
  "fallbackRevenue": "int",
  "errorMsg": "string | null",
  "items": [
    {
      "role": "int",
      "roleName": "string",
      "recipientId": "long",
      "recipientName": "string",
      "amount": "decimal",
      "feeFlag": "int",
      "feeAmount": "decimal | null",
      "bankName": "string",
      "cardNoMask": "string",
      "provName": "string",
      "areaName": "string"
    }
  ]
}
```

#### `POST /pay/profit-sharing-order/sync-settlement-status`

**模块**: `yshop-module-pay-biz`
**权限**: `order:settlement:query`
**说明**: 按订单号查询 AdaPay 远端支付确认对象，并把远端状态同步至当前租户的本地分账记录。支持没有本地分账记录的 AdaPay 订单：使用订单支付流水号查询并导入已有确认快照。接口不创建、不重试分账。远端 `succeeded` / `pending` 或 `I` / `failed` 或 `F` 分别映射为页面结算状态。

请求：`orderId`（必填，query parameter）

响应：页面结算状态整数，`0` 未结算、`1` 待分账、`2` 分账中、`3` 已结算、`4` 分账失败。AdaPay 返回成功但确认列表为空时返回 `0`，表示支付成功但没有分账确认记录；远端调用异常仍返回业务错误。无本地分账记录时，查询到的远端确认会创建本地分账快照，保存手续费金额和承担方信息。

## 数据库变更

`yshop_adapay_profit_sharing_order` 和 `yshop_adapay_profit_sharing_payment` 增加可空 `fee_amount`，记录 AdaPay 支付确认返回的手续费金额。不对历史数据估算回填。另新增菜单数据：

```sql
INSERT INTO system_menu (name, permission, type, sort, parent_id, path, component, component_name, icon, status, deleted, create_time, update_time)
VALUES ('订单结算管理', 'order:settlement:query', 2, 2, 2175, 'settlement',
        'order/settlement/index', 'OrderSettlement', 'ep:money', 0, 0, NOW(), NOW());
```

## 权限变更

| 权限字符串 | 类型 | 说明 |
|------------|------|------|
| `order:settlement:query` | 新增 | 查看订单结算列表和明细 |

需在 `system_menu` 表中注册菜单项（type=2），并分配权限字符串。

## 依赖变更

无。

## 安全边界

- 银行卡号仅返回脱敏摘要（`card_no_mask`），不返回完整卡号。
- 租户数据隔离由 `TenantBaseDO` + MyBatis Plus 拦截器自动注入。
- 明细端点只读；同步端点仅更新已有分账记录的状态、确认单 ID、时间、错误信息、手续费标记和手续费金额。没有本地记录时同步会导入远端已有确认及对应手续费快照，不创建或触发分账。非 AdaPay 支付不能通过 AdaPay 查询同步。
