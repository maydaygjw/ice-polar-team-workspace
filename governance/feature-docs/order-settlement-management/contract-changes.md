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
- 无写操作，仅查询端点。
