# 第三方支付 OpenAPI

本文供接入平台支付能力的第三方后端开发者和平台管理员使用，说明 OAuth2 客户端令牌、微信/AdaPay 支付、支付查询、AdaPay 结算、全额退款、微信商家转账及支付/转账结果 Webhook。

第三方后端通过本 API 创建和管理支付单；付款人通过所选渠道完成付款。平台不提供托管收银页面，第三方不需要维护支付商户密钥或证书。

## 接入前准备

平台管理员需要完成以下配置：

1. 在系统的 OAuth2 客户端管理中创建并启用 `client_credentials` 客户端，安全保存 `client_id` 和 `client_secret`。
2. 在该客户端的 scope 文本框中输入获准的权限，多个 scope 用英文逗号分隔，支付、结算与用户转账 OpenAPI 使用 `payment`。创建支付请求的 `payType` 可选 `weixin`（默认）或 `adapay`。scope 与后台菜单权限相互独立。
3. 在当前租户的支付配置中，启用所需渠道配置的“允许外部 OpenAPI 调用”开关，并配置 Webhook 地址。微信渠道需且只能启用一个微信小程序或公众号配置；AdaPay 渠道需启用当前租户的 AdaPay 配置，并配置微信小程序子 AppID。
4. 使用微信或 AdaPay 小程序支付时，确认第三方提供的 `payerOpenId` 属于对应微信小程序 AppID。发起用户转账时，`openidType` 默认是 `MINIAPP`；选择 `MP` 时，`openid` 必须对应当前租户已有会员的公众号 OpenID。

OpenAPI 不接受请求方提交的商户号、密钥、证书、支付配置 ID 或临时通知地址。商户支付配置由平台在当前租户内统一维护。

## 约定

| 项目 | 约定 |
|---|---|
| API 前缀 | `/open-api` |
| 传输 | HTTPS；JSON 请求/响应，令牌接口使用 `application/x-www-form-urlencoded` |
| 成功响应 | 平台 `CommonResult`：`{"code":0,"msg":"","data":...}` |
| 租户 | 每次请求都携带 `tenant-id` 请求头；令牌绑定的租户必须与请求头一致 |
| 令牌 | `Authorization: Bearer <access_token>` |
| 金额 | 人民币分，正整数；首期只支持 `CNY` |
| 订单隔离 | 只能访问当前 OAuth2 客户端创建的支付单；其他客户端的支付单按不存在处理 |

将 `/open-api` 拼接到部署环境 API 域名后使用。例如：`https://api.example.com/open-api/v1/payments`。具体域名由平台提供。

## 权限范围

| Scope | 能力 |
|---|---|
| `payment` | 创建、查询微信/AdaPay 支付单、结算 AdaPay 支付单、申请全额原路退款，以及向当前租户会员发起微信商家转账 |

令牌请求的 `scope` 可省略；省略时授予客户端登记的全部 scope。显式请求 scope 时，所有 scope 必须已由客户端精确授权。支付接口统一检查 `payment` scope。scope 配置不支持通配符。令牌只代表第三方客户端，不是会员或管理员身份。客户端凭证、访问令牌和支付渠道参数均不得写入日志。

## 获取访问令牌

`POST /open-api/oauth2/token`

使用 HTTP Basic 认证传入 `client_id` 和 `client_secret`，请求体为表单格式。`scope` 可省略；显式传入时使用空格分隔，与管理端维护 scope 时使用的逗号分隔格式不同。

```http
POST /open-api/oauth2/token
Authorization: Basic <base64(client_id:client_secret)>
tenant-id: 1001
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=payment
```

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "access_token": "<access-token>",
    "token_type": "bearer",
    "expires_in": 1800,
    "scope": "payment"
  }
}
```

`expires_in` 的单位是秒。客户端凭证模式不返回 refresh token；过期后使用相同客户端凭证重新申请。接口只支持 `grant_type=client_credentials`，并要求 `tenant-id`。

## 创建支付单

`POST /open-api/v1/payments`

需要 `payment` scope 和 `Idempotency-Key` 请求头。幂等键最多 128 个字符。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `payType` | string | 否 | `weixin` 或 `adapay`，默认 `weixin` |
| `clientOrderNo` | string | 是 | 第三方业务订单号，最多 128 个字符；在同一 OAuth2 客户端内唯一 |
| `businessRegionCode` | string | 是 | 已启用的商圈编码，最多 64 个字符；用于确定订单归属及平台默认店铺 |
| `amount` | integer | 是 | 支付金额，人民币分，必须大于 0 |
| `currency` | string | 是 | 币种，首期只支持 `CNY` |
| `subject` | string | 是 | 支付标题，最多 128 个字符 |
| `payerOpenId` | string | 是 | 微信 JSAPI 或 AdaPay 小程序支付的付款人 OpenID，最多 128 个字符，必须属于对应微信小程序 AppID |
| `beforeCouponAmount` | integer | 否 | 券前金额，人民币分，非负；省略时按 `amount - freightPrice + couponPrice + deductionPrice` 推算 |
| `platformSubsidyAmount` | integer | 否 | 平台补贴金额，人民币分，非负；省略时为 `0` |
| `totalPostage` | integer | 否 | 订单总邮费，人民币分，非负 |
| `payPostage` | integer | 否 | 支付邮费，人民币分，非负 |
| `freightPrice` | integer | 否 | 运费金额，人民币分，非负；参与实付金额校验 |
| `boxFeePrice` | integer | 否 | 餐盒费，人民币分，非负 |
| `deductionPrice` | integer | 否 | 抵扣金额，人民币分，非负；参与实付金额校验 |
| `couponPrice` | integer | 否 | 优惠券金额，人民币分，非负；参与实付金额校验 |
| `boxFeeForPlatform` | integer | 否 | 平台餐盒费抽成，人民币分，非负 |
| `serviceFee` | integer | 否 | 订单服务费，人民币分，非负 |

计费字段是请求对象的普通顶层字段，不放在嵌套的 `billingAttributes` 对象中。计费字段只适用于 `payType=adapay`；任一计费字段用于微信支付会被拒绝。AdaPay 实付金额必须满足：`amount = max(beforeCouponAmount - couponPrice - deductionPrice, 0) + freightPrice`。计算单位均为人民币分；缺省的 `couponPrice`、`deductionPrice` 和 `freightPrice` 按 `0` 计算。省略 `beforeCouponAmount` 时，按上述字段反推券前金额。

`businessRegionCode` 必须对应已启用商圈。商圈配置了 OpenAPI 默认店铺时，订单使用该店铺计费；未配置默认店铺时，按平台直接收款生成平台专用计费快照，不要求提供店铺。

```http
POST /open-api/v1/payments
Authorization: Bearer <access-token>
tenant-id: 1001
Idempotency-Key: order-20261102-001-create
Content-Type: application/json

{
  "payType": "weixin",
  "clientOrderNo": "order-20261102-001",
  "businessRegionCode": "REGION001",
  "amount": 12800,
  "currency": "CNY",
  "subject": "订单支付",
  "payerOpenId": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"
}
```

AdaPay 创建请求示例（计费项均为顶层字段）：

```json
{
  "payType": "adapay",
  "clientOrderNo": "order-20261102-002",
  "businessRegionCode": "REGION001",
  "amount": 12800,
  "currency": "CNY",
  "subject": "订单支付",
  "payerOpenId": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o",
  "beforeCouponAmount": 12800,
  "platformSubsidyAmount": 0,
  "totalPostage": 1000,
  "payPostage": 1000,
  "freightPrice": 1000,
  "boxFeePrice": 0,
  "deductionPrice": 500,
  "couponPrice": 500,
  "boxFeeForPlatform": 0,
  "serviceFee": 0
}
```

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "paymentId": "1969876543210000001",
    "clientOrderNo": "order-20261102-001",
    "payType": "weixin",
    "amount": 12800,
    "currency": "CNY",
    "status": "PENDING",
    "refundStatus": "NOT_REFUNDED",
    "appId": "wx-example-appid",
    "paymentData": {
      "timeStamp": "1793613759",
      "nonceStr": "example-nonce",
      "package": "prepay_id=wx-example",
      "signType": "RSA",
      "paySign": "<微信支付签名>"
    },
    "transactionId": null,
    "expireTime": "2026-11-02T20:15:00",
    "paidTime": null,
    "refundTime": null
  }
}
```

`paymentData` 按渠道返回网关调起数据：微信渠道是 JSAPI 参数，AdaPay 渠道是小程序支付参数。调用方应按所选渠道把数据传递到对应的支付客户端，不要将支付参数或完整支付响应写入普通业务日志。AdaPay 返回网关状态 `succeeded` 只表示创建支付请求成功，不等于用户已完成付款；以平台支付单 `status=SUCCESS` 为准。

支付单有效期为创建后 2 小时。微信预支付参数暂时未生成时，接口仍可能返回 `PENDING` 且 `paymentData` 为空对象；使用相同请求内容和相同幂等键重试创建，可继续获取该支付单的调起参数，不会新建另一笔支付单。

同一客户端对同一 `clientOrderNo` 使用相同请求内容和相同幂等键重试，会返回原支付单。订单号已存在但支付内容不同，或订单号绑定了另一个幂等键时返回冲突错误。请为每笔业务订单生成并持久化幂等键；网络超时后重试时不要换键。

## 查询支付单

### 按平台支付单号查询

`GET /open-api/v1/payments/{paymentId}`

需要 `payment` scope。

```http
GET /open-api/v1/payments/1969876543210000001
Authorization: Bearer <access-token>
tenant-id: 1001
```

### 按第三方订单号查询

`GET /open-api/v1/payments/by-client-order/{clientOrderNo}`

需要 `payment` scope。`clientOrderNo` 应按 URL 路径段进行编码。

两个查询接口返回与创建接口相同的支付单字段。微信 `PENDING` 支付和 `PROCESSING` 退款由微信查单刷新；AdaPay 支付与退款状态由经过验签的 AdaPay 回调和后台查单刷新。支付成功以平台确认的状态为准，不要仅凭支付接口创建成功、客户端支付 SDK 回调或 AdaPay 预支付响应判断成功。

## 主动结算 AdaPay 支付单

`POST /open-api/v1/payments/by-client-order/{clientOrderNo}/settle`

需要 `payment` scope。仅支持当前 OAuth2 客户端创建且平台状态为 `SUCCESS` 的 AdaPay 支付单。订单退款处理中或已退款时不能结算。商圈配置了默认店铺时，接口按订单计费快照执行结算；商圈没有默认店铺、平台直接收款时，返回 `NOT_REQUIRED`，表示无需分账。

```http
POST /open-api/v1/payments/by-client-order/order-20261102-001/settle
Authorization: Bearer <access-token>
tenant-id: 1001
```

响应示例：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "paymentId": "1969876543210000001",
    "clientOrderNo": "order-20261102-001",
    "settlementStatus": "SUCCESS",
    "settled": true,
    "message": "结算成功"
  }
}
```

`settlementStatus` 可能为 `SUCCESS`、`NOT_REQUIRED` 或 `NOT_SETTLED`。`NOT_SETTLED` 表示结算尚未完成，可检查分账状态后重试；调用结算接口前应先查询支付单确认 `status=SUCCESS`。

## 申请全额退款

`POST /open-api/v1/payments/{paymentId}/refund`

需要 `payment` scope 和独立的退款 `Idempotency-Key`。只支持已支付订单的全额原路退款，不接收退款金额。请求体可省略；`reason` 可选，最多 256 个字符。

```http
POST /open-api/v1/payments/1969876543210000001/refund
Authorization: Bearer <access-token>
tenant-id: 1001
Idempotency-Key: order-20261102-001-refund
Content-Type: application/json

{
  "reason": "客户取消订单"
}
```

响应仍为支付单对象，其中 `refundStatus` 表示退款进度。`PROCESSING` 仅表示平台已提交退款，不代表渠道已完成退款；继续查询支付单，直到得到 `SUCCESS` 或 `FAILED`。退款处理中或已成功时，只能使用原退款幂等键重复提交；不同键会被拒绝。

## 向用户发起微信商家转账

`POST /open-api/v1/payments/transfers`

需要 `payment` scope。此接口使用微信 APIv3 商家转账能力，向指定微信 OpenID 转账；`openidType` 选择 OpenID 所属应用，支持小程序和公众号，缺省为小程序。`openid` 必须匹配当前租户会员对应应用的 OpenID。调用方无需传会员 `userId`、AppID、商户号、场景 ID、回调地址或商户密钥，这些由后端按当前租户关联会员并使用对应的微信支付商户配置。此接口不支持 AdaPay。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `openid` | string | 是 | 收款人的微信 OpenID，所属应用由 `openidType` 指定 |
| `openidType` | string | 否 | OpenID 所属应用：`MINIAPP`（小程序，默认）或 `MP`（公众号） |
| `amount` | integer | 是 | 转账金额，人民币分，必须大于 0；例如 `1000` 表示 ¥10.00 |
| `clientOrderNo` | string | 是 | 第三方转账业务单号，1–32 位字母、数字、下划线或连字符；同一笔转账重试必须复用。后端将其作为微信商户单号 `outBillNo` 使用 |
| `remark` | string | 否 | 转账备注；未传时使用默认备注 |

```http
POST /open-api/v1/payments/transfers
Authorization: Bearer <access-token>
tenant-id: 1001
Content-Type: application/json

{
  "openid": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o",
  "openidType": "MINIAPP",
  "amount": 1000,
  "clientOrderNo": "transfer-20261107-001",
  "remark": "活动奖励"
}
```

成功响应示例：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "clientOrderNo": "transfer-20261107-001",
    "outBillNo": "transfer-20261107-001",
    "transferBillNo": "wx-transfer-bill-no",
    "createTime": "2026-11-07T10:15:30+08:00",
    "state": "WAIT_USER_CONFIRM",
    "packageInfo": "<微信用户确认收款参数>"
  }
}
```

成功响应包含 `clientOrderNo`、微信返回的 `outBillNo`、`transferBillNo`、`state`、`createTime` 和 `packageInfo`。当前 `outBillNo` 与 `clientOrderNo` 相同。微信可能要求用户确认收款；接口受理或返回 `packageInfo` 不代表款项已到账。最终状态以后端查单/微信转账通知为准。网络超时或结果未知时，必须用相同 `clientOrderNo` 重试，不得换单号重复打款。转账记录会写入统一用户转账明细，可在平台现有查询能力中查看。

## 状态字段

### 支付状态 `status`

| 值 | 含义 |
|---|---|
| `PENDING` | 等待支付结果 |
| `SUCCESS` | 平台已确认支付成功 |
| `FAILED` | 支付渠道确认支付失败 |
| `CLOSED` | 支付单已关闭 |

### 退款状态 `refundStatus`

| 值 | 含义 |
|---|---|
| `NOT_REFUNDED` | 尚未退款 |
| `PROCESSING` | 退款处理中 |
| `SUCCESS` | 平台已确认全额退款成功 |
| `FAILED` | 退款失败或异常结束 |

时间字段 `expireTime`、`paidTime`、`refundTime` 可能为空；除 `expireTime` 外，支付或退款尚未进入对应终态时相关时间为空。

## 支付与转账结果 Webhook

管理员在当前租户对应的支付渠道配置中维护 Webhook 地址。平台确认支付成功、支付失败、支付关闭或退款成功后，会创建对应事件并向该地址发送明文 JSON `POST`；不添加应用层签名或加密。AdaPay 预支付请求创建成功不会单独触发支付成功 Webhook；必须等实际支付状态被平台确认。生产环境请配置 HTTPS 接收地址。

```http
POST <支付配置中维护的 Webhook URL>
Content-Type: application/json; charset=utf-8
X-OpenAPI-Event-Id: <eventId>

{
  "eventId": "4d2e3ea100004...",
  "eventType": "payment.succeeded",
  "paymentId": "1969876543210000001",
  "payType": "weixin",
  "clientOrderNo": "order-20261102-001",
  "status": "SUCCESS",
  "refundStatus": "NOT_REFUNDED",
  "amount": 12800,
  "currency": "CNY",
  "occurredAt": "2026-11-02T18:20:00"
}
```

Webhook 的 `eventType` 枚举值为 `payment.succeeded`、`payment.failed`、`payment.closed`、`payment.refunded`；`payType` 为 `weixin` 或 `adapay`；`status` 为 `PENDING`、`SUCCESS`、`FAILED`、`CLOSED`；`refundStatus` 为 `NOT_REFUNDED`、`PROCESSING`、`SUCCESS`、`FAILED`。接收端应先持久化事件，再返回任意 `2xx`；用 `eventId` 做幂等去重。平台按至少一次方式投递，同一事件可能重复到达，事件 ID 在重试时保持不变。

微信商家转账进入终态后，平台也会向同一 Webhook 地址发送统一的转账事件。所有转账终态使用相同结构，通过 `eventType` 和 `state` 表达结果：

```json
{
  "eventId": "0db4aa9400004...",
  "eventType": "transfer.succeeded",
  "clientOrderNo": "transfer-20261107-001",
  "outBillNo": "transfer-20261107-001",
  "transferBillNo": "wx-transfer-bill-no",
  "state": "SUCCESS",
  "amount": 1000,
  "currency": "CNY",
  "occurredAt": "2026-11-07T10:20:00"
}
```

转账事件类型为 `transfer.succeeded`、`transfer.failed`、`transfer.cancelled`，分别对应微信终态 `SUCCESS`、`FAIL`、`CANCELLED`。`clientOrderNo` 是调用方业务单号，`outBillNo` 是微信商户单号（当前两者相同）；`amount` 单位为人民币分。消息不包含 OpenID、`packageInfo` 或商户凭据。接收端按 `eventId` 幂等去重，并在成功处理后返回 `2xx`。

首次投递在后台任务调度后执行，非 `2xx` 或网络错误会重试，单次连接/读取/调用超时为 5 秒。最多投递 8 次，失败重试间隔为 1 分钟、5 分钟、30 分钟、2 小时、6 小时、12 小时、24 小时。超过次数后停止自动投递。接收地址必须是标准 HTTP/HTTPS 地址（80/443 端口），并解析到公网 IP；平台不跟随重定向。

## 错误处理

业务响应使用 `CommonResult`。成功时 `code` 为 `0`；失败时查看非零 `code` 和 `msg`。具体 HTTP 状态码由部署环境的异常处理和网关配置决定，调用方不要只根据 HTTP 200 判断业务成功。

常见业务错误：

| 错误码 | 含义 |
|---|---|
| `2026110210` | 幂等键过长，或币种不受支持 |
| `2026110211` | 第三方订单号已用于不同支付内容，或订单号/幂等键冲突 |
| `2026110212` | 第三方订单号已绑定其他创建幂等键 |
| `2026110213` | 支付单不存在或不属于当前客户端 |
| `2026110214` | 支付单已有退款请求，幂等键不匹配 |
| `2026110215` | 仅已支付订单支持退款 |
| `2026110216` | 原支付单使用的支付渠道配置不可用 |
| `2026110217` | 租户未配置所选渠道的 OpenAPI 支付配置 |
| `2026110218` | OpenAPI 访问令牌无效 |
| `2026110412` | 支付所属商圈不存在或未启用 |
| `2026110413` | 商圈配置的 OpenAPI 默认店铺不可用 |
| `2026110419` | 主动结算仅支持 AdaPay 支付单 |
| `2026110420` | 仅平台已确认支付成功的订单支持结算 |
| `2026110421` | 退款处理中或已退款的订单不能结算 |

收到令牌缺失、过期或无效错误时，重新申请令牌。创建支付或退款遇到超时、连接中断或 5xx 时，先使用原幂等键重试或查询，不要换键重复创建交易。

## 支持范围

支持微信 JSAPI 与汇付（Adapay）支付创建、支付查询、全额原路退款、支付结果 Webhook，以及面向当前租户会员的微信商家转账。用户确认收款页面由调用方根据 `packageInfo` 和微信对应能力完成；OpenAPI 不提供商家转账确认页面、部分退款、支付宝或平台托管收银页面。
