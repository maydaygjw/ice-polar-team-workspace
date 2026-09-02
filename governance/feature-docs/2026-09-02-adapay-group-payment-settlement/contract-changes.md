# AdaPay 拼单多支付单结算契约变更

## 1. 数据库契约

新增 `yshop_adapay_profit_sharing_payment`，一条记录对应一个 AdaPay `payment_id` 的分账确认任务。

核心约束：

- 所有记录包含 `tenant_id`。
- `adapay_payment_id` 在租户内唯一。
- `confirm_amount` 等于该支付对象本次确认金额。
- `adapay_confirm_id` 成功后写入，处理中/失败时允许为空。
- 子记录状态不得覆盖已成功状态。

扩展 `yshop_adapay_profit_sharing_order_item.sharing_payment_id`，拼单明细必须关联子记录，普通历史明细允许为空。

迁移脚本：`backend/sql/upgrade-2026-09-02-adapay-group-payment-settlement.sql`。

## 2. 内部 API 契约

`ProfitSharingOrderApi` 增加支付对象级能力：

```java
List<Long> createSharingPayments(Long sharingOrderId);
boolean executeSharingPayment(Long sharingPaymentId);
boolean fallbackSharingPayment(Long sharingPaymentId);
```

现有 `executeSharing(Long id)` 保留，行为变为：

- 普通订单执行单个兼容任务。
- 拼单订单遍历未完成的支付分账子记录。
- 不重复执行已成功或已回退子记录。

## 3. 管理端订单结算接口

现有订单结算列表仍以业务订单为一行，`settlementStatus` 改为订单级聚合状态。

订单结算详情增加：

```json
{
  "paymentSharings": [
    {
      "id": 101,
      "paymentId": "pay_xxx",
      "payAmount": 0.20,
      "confirmAmount": 0.20,
      "confirmId": "confirm_xxx",
      "sharingStatus": 2,
      "fallbackRevenue": 0,
      "sharingTime": "2026-09-02T10:00:00",
      "errorMsg": null,
      "items": []
    }
  ]
}
```

重试接口接收支付分账子记录 ID；已成功、已回退或处理中记录不得重试。既有普通订单请求保持兼容。

## 4. 日终对账契约

本地支付金额规则：

```text
pay_out_order_no.pay_amount 非空时使用 pay_amount；否则使用订单 pay_price。
```

对账明细的匹配维度：

- Charge：`payment_id`
- PaymentConfirm：`payment_id + confirm_id`
- Div：`payment_id + confirm_id + member_id`

同一业务订单出现多个支付对象和确认对象时，必须生成多条可定位明细，不得合并成一条模糊记录。

## 5. 订单/退款契约

- 订单级结算状态由全部支付分账子记录聚合。
- 退款和撤销按 `pay_out_order_no` 全量成功支付记录执行。
- 已有成功分账子记录时，继续遵循分账后禁止退款的现行规则。
- 不新增小程序 API，不改变 AdaPay 外部接口。

## 6. 兼容性与权限

- 普通订单和历史分账记录无需回填即可读取。
- 所有新增查询必须包含租户条件。
- 管理端继续使用现有订单结算、分账重试、对账查询权限。
- 不新增 MQ 消息类型；现有支付成功和结算任务消息只携带业务订单/支付记录标识，消费者按子记录幂等处理。
