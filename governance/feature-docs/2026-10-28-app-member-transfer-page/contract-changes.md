# App 会员微信打款记录分页接口契约

## App API

`GET /app-api/pay/member-transfer/page`：分页查询当前登录会员自己的微信打款记录，要求会员登录，并按当前租户隔离。

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `userId` | Long | 与 `externalUserId` 至少一个 | 会员内部 ID |
| `externalUserId` | String | 与 `userId` 至少一个 | 外部系统会员 ID |
| `pageNo` | Integer | 否 | 页码，从 1 开始，默认 1 |
| `pageSize` | Integer | 否 | 每页条数，默认 10，最大 100 |

当两个用户标识都传入时，必须解析到同一个会员。传入的会员必须与当前登录会员 ID 一致；否则拒绝查询。记录按 `createTime` 倒序。

响应为现有 `CommonResult<PageResult<...>>`，每条记录包含：

- `id`、`userId`、`outBillNo`、`transferBillNo`
- `appId`、`mchId`、`packageInfo`、`transferAmount`（分）、`state`、`transferRemark`
- `failReason`、`createTime`

`appId` 和 `mchId` 通过当前租户的微信小程序支付配置关联查询，不在打款记录表中保存；未配置时字段为空。`packageInfo` 保存在打款记录中，用于用户确认收款；该接口只查询记录，不向微信支付发起请求。
