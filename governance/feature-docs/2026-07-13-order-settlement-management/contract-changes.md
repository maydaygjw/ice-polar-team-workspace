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
  "payType": "string",
  "orderStatus": "int",
  "payTime": "datetime | null",
  "createTime": "datetime",
  "profitSharingOrderId": "long | null",
  "settlementStatus": "int",
  "sharingTime": "datetime | null"
}
```

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
**说明**: 按订单号查询 AdaPay 远端支付确认对象，并把远端状态同步至当前租户的本地分账记录。支持没有本地分账记录的 AdaPay 订单：使用订单支付流水号查询，只把查询到的状态显示在当前列表行。接口不创建、不重试分账。远端 `succeeded` / `pending` 或 `I` / `failed` 或 `F` 分别映射为页面结算状态。

请求：`orderId`（必填，query parameter）

响应：页面结算状态整数，`0` 未结算、`1` 待分账、`2` 分账中、`3` 已结算、`4` 分账失败。AdaPay 返回成功但确认列表为空时返回 `0`，表示支付成功但没有分账确认记录；远端调用异常仍返回业务错误。无本地分账记录的查询结果仅更新当前页面行，刷新后仍显示未结算。

## 数据库变更

无 Schema 变更。仅新增菜单数据：

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
- 列表和明细端点只读；同步端点仅更新已存在分账记录的状态、确认单 ID、时间和错误信息。没有本地记录时只返回远端状态、不落库，也不创建分账记录或触发分账。非 AdaPay 支付不能通过 AdaPay 查询同步。
