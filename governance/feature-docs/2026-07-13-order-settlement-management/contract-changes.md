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
**说明**: 按订单号查询 AdaPay 远端支付确认对象，并将远端状态和分账明细同步至当前租户的本地分账记录。已有本地分账记录时，远端返回完整 `div_members` 后，在单一事务内以远端明细替换本地分账明细；状态和手续费按远端确认同步，分账主记录和支付级记录保留。拼单中已回退到本地 Revenue 的支付级明细保留，其余支付级明细按各自确认记录重建。远端明细缺失时仅更新状态和手续费、保留已有明细；查询失败或无有效确认时，已有本地记录保持不变。没有本地分账记录的 AdaPay 订单使用订单支付流水号查询并导入已有确认快照。接口不创建、不重试分账。远端 `succeeded` / `pending` 或 `I` / `failed` 或 `F` 分别映射为页面结算状态。

请求：`orderId`（必填，query parameter）

响应：页面结算状态整数，`0` 未结算、`1` 待分账、`2` 分账中、`3` 已结算、`4` 分账失败。AdaPay 返回成功但确认列表为空时返回 `0`，表示支付成功但没有分账确认记录；远端调用异常仍返回业务错误。已有记录时仅在所有待同步的 AdaPay 确认均含有效分账明细后替换本地明细；无本地分账记录时，查询到的远端确认会创建本地分账快照，保存手续费金额和承担方信息。

远端 `div_members[].member_id` 为 `0` 时，本地分账角色映射为“平台”，不将该标识当作平台级收款人的 Member ID。其他 Member ID 按当前租户匹配启用的平台级收款人，或按订单店铺匹配有效绑定历史中的店铺级收款人。若多个不同收款人同时匹配同一 Member ID，则不猜测归属，明细保留为未匹配外部收款人。

#### `POST /pay/receivable-payable/sync-settlement-status/tasks`

**模块**: `yshop-module-pay-biz`
**权限**: `order:settlement:query`
**说明**: 创建按一个支付日期和多店铺范围执行的异步分账状态同步任务。

请求体：`payDate`（必填日期）、`shopIds`（必填，1—100 个当前租户店铺 ID）。

响应：任务 ID。一个租户同时只能运行一个应收应付生成或分账状态同步任务；任务创建时验证所有店铺归属当前租户。

#### `GET /pay/receivable-payable/sync-settlement-status/tasks/{id}`

**模块**: `yshop-module-pay-biz`
**权限**: `order:settlement:query`
**说明**: 查询当前用户创建的分账状态同步任务进度，响应沿用 `ReceivablePayableGenerationTaskRespVO` 并增加 `taskType`。

响应包含任务类型、支付日期、状态、候选总数、已处理数、成功/跳过/失败数、百分比、失败摘要和结束时间。分账状态同步任务按订单 ID 游标处理该支付日和店铺范围内已支付的 AdaPay 订单，且仅包含退款正常或已驳回（`refund_status` 0、3）的订单，排除退款中和已退款订单；逐单复用单笔同步规则，单笔失败不中断任务。接口不创建或重试分账。任务记录复用 `yshop_pay_receivable_payable_generation_task`，新增 `task_type` 区分应收应付生成和分账状态同步，任务进度可在管理后台轮询及页面刷新后恢复。

订单模块内部 `OrderApi` 增加通用 `countPaidOrders(LocalDate payDate, List<Long> shopIds, PayTypeEnum payType, List<OrderInfoEnum> refundStatuses)` 和 `listPaidOrderIds(Long afterId, LocalDate payDate, List<Long> shopIds, PayTypeEnum payType, List<OrderInfoEnum> refundStatuses, int limit)`，按支付日期、店铺集合、支付方式、可选退款状态及订单 ID 游标统计/查询已支付订单号。支付方式或退款状态可省略以查询全部值。Pay 模块同步结算状态时传入 `PayTypeEnum.ADAPAY` 和退款状态 `REFUND_STATUS_0`、`REFUND_STATUS_3`；订单模块不包含分账或结算专用查询接口，Pay 模块也不直接访问订单表。管理后台创建一个任务后轮询该同步任务的进度接口。

## 数据库变更

`yshop_pay_receivable_payable_generation_task` 新增 `task_type` 字段，默认 `GENERATE_RECEIVABLE_PAYABLE` 以兼容已有任务，并以 `SYNC_SETTLEMENT_STATUS` 标记分账状态同步任务；不新建任务表。

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
- 明细端点只读；同步端点可在完整读取远端确认后事务性替换已有本地分账明细，同时更新状态、确认单 ID、时间、错误信息、手续费标记和手续费金额。远端读取或明细校验失败时保留原明细。没有本地记录时同步会导入远端已有确认及对应手续费快照，不创建或触发分账。非 AdaPay 支付不能通过 AdaPay 查询同步。
