eb3df4f06ff7cafd63c1765461786c76d1cf0f2a# pay-java-adapay：AdaPay 结算明细查询接口参考

> 状态：已实现并验证。当前业务侧使用 `2.14.14-SNAPSHOT`，本文件仅作为 SDK 接口参考，不是业务功能需求文档。

## 背景

当前 `pay-java-adapay 2.14.14-SNAPSHOT` 已支持：

- 创建、删除结算账户
- 分账确认与查询
- 支付查询
- 对账账单下载

并已封装 AdaPay 官方 `SettleAccount.detail` 结算明细查询接口。

业务系统可每天定时查询所有分账收款人的实际结算到账记录，并将结果保存到本地。

官方文档：<https://docs.adapay.tech/api/trade.html#settle-detail-query>

## 接口位置

```text
com.holuntech.pay.adapay.api.AdapayPayService
```

已提供以下方法：

```java
Map<String, Object> querySettleDetail(
        String memberId,
        String settleAccountId,
        Date beginDate,
        Date endDate
);
```

同时提供参数 Map 版本，方便后续扩展：

```java
Map<String, Object> querySettleDetail(
        Map<String, Object> params
);
```

## 请求参数

SDK 自动从现有配置中读取 `app_id`，调用方传入：

| 参数 | 必填 | 说明 |
|---|---|---|
| `member_id` | 是 | 收款人 Member ID；查询商户自身时传 `0` |
| `settle_account_id` | 否 | AdaPay 结算账户 ID；查询商户自身时可不传 |
| `begin_date` | 是 | 开始日期，格式 `yyyyMMdd` |
| `end_date` | 是 | 结束日期，格式 `yyyyMMdd` |

要求：

- 日期格式由 SDK 统一转换为 `yyyyMMdd`。
- 查询时间跨度必须校验为不超过 31 天。
- 参数错误沿用 SDK 现有异常处理方式。
- 复用现有 AdaPay 签名、密钥和 HTTP 请求机制。
- 不要使用 `downloadBill` 替代此接口。

## 响应数据

成功时保留 AdaPay 原始响应结构：

```json
{
  "object": "list",
  "prod_mode": "true",
  "status": "succeeded",
  "settle_details": [
    {
      "card_name": "测试商户",
      "card_no": "130234****8399",
      "settle_date": "20191014",
      "settle_amt": "6.98",
      "settle_fee_amt": "0.00",
      "settle_stat": "succeeded",
      "settle_type": "T1",
      "settle_message": ""
    }
  ]
}
```

`settle_details` 字段包括：

- `card_name`
- `card_no`
- `settle_date`
- `settle_amt`
- `settle_fee_amt`
- `settle_stat`
- `settle_type`
- `settle_message`

当没有结算记录时，应正常返回空的 `settle_details`，不能当作异常。

## 状态支持

至少保留以下 AdaPay 状态：

- `succeeded`：成功
- `failed`：失败
- `pending`：处理中
- `no-started`：未发起

结算类型至少保留：

- `T1`
- `D1`
- `B`

## 兼容性

- 不修改现有公开方法行为。
- 不影响现有支付、分账、退款和账单下载功能。
- 保持现有包名、配置类和异常体系兼容。
- 新增接口支持 AdaPay 生产环境和 Mock 环境。
- 当前业务项目已验证可使用 `com.holuntech:pay-java-adapay:2.14.14-SNAPSHOT`。

## 测试要求

增加单元测试，至少覆盖：

1. 正常查询并正确组装请求参数。
2. `member_id=0` 时可以不传 `settle_account_id`。
3. 日期格式转换正确。
4. 日期跨度超过 31 天时校验失败。
5. AdaPay 返回成功且包含结算明细。
6. AdaPay 返回成功但明细为空。
7. AdaPay 返回失败时，错误码和错误信息可被业务侧识别。
8. 签名和请求方式与现有 SDK 保持一致。

## 验收标准

业务侧可以通过以下方式查询指定收款人的结算明细：

```java
Map<String, Object> result = adapayPayService.querySettleDetail(
        memberId,
        settleAccountId,
        beginDate,
        endDate
);
```

并能够获取每条记录的：

```text
结算日期、结算金额、手续费、结算状态、结算类型、失败原因
```
