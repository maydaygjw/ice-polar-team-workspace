# 第三方支付 OpenAPI

本文供接入平台支付能力的第三方后端开发者和平台管理员使用，说明 OAuth2 客户端令牌、微信 JSAPI 支付、支付查询、全额退款及支付结果 Webhook。

第三方后端通过本 API 创建和管理支付单；付款人仍在第三方自己的微信 H5/小程序中完成付款。平台不提供收银页面，第三方不需要维护微信商户密钥或证书。

## 接入前准备

平台管理员需要完成以下配置：

1. 在系统的 OAuth2 客户端管理中创建并启用 `client_credentials` 客户端，安全保存 `client_id` 和 `client_secret`。
2. 在该客户端的 scope 文本框中输入获准的权限，多个 scope 用英文逗号分隔，例如 `payment:create,payment:read,payment:refund`。也可使用非空前缀的尾部 `*`，例如 `payment*` 授权所有以 `payment` 开头的具体 scope，包括以后新增的匹配 scope。scope 与后台菜单权限相互独立。
3. 在当前租户的支付配置中，启用一个微信 JSAPI 支付配置的“允许外部 OpenAPI 调用”开关，并配置 Webhook 地址。当前租户必须且只能有一个启用此开关的微信小程序或微信公众号支付配置。
4. 确认第三方提供的 `payerOpenId` 属于该支付配置对应的微信 AppID。

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
| `payment:create` | 创建微信 JSAPI 支付单 |
| `payment:read` | 按平台支付单号或第三方订单号查询 |
| `payment:refund` | 申请全额原路退款 |

申请令牌的 scope 必须已由客户端配置精确授权或匹配配置中的前缀通配符。令牌请求必须填写具体 scope（如 `payment:create payment:read`），不能请求 `payment*`；单独的 `*` 不支持。支付接口仍逐个精确检查具体 scope。通配符也会覆盖以后新增的匹配 scope，请只配置可信任的前缀。令牌只代表第三方客户端，不是会员或管理员身份。客户端凭证、访问令牌和微信 JSAPI 支付参数均不得写入日志。

## 获取访问令牌

`POST /open-api/oauth2/token`

使用 HTTP Basic 认证传入 `client_id` 和 `client_secret`，请求体为表单格式。`scope` 使用空格分隔；它与管理端维护 scope 时使用的逗号分隔格式不同。

```http
POST /open-api/oauth2/token
Authorization: Basic <base64(client_id:client_secret)>
tenant-id: 1001
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=payment%3Acreate%20payment%3Aread
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
    "scope": "payment:create payment:read"
  }
}
```

`expires_in` 的单位是秒。客户端凭证模式不返回 refresh token；过期后使用相同客户端凭证重新申请。接口只支持 `grant_type=client_credentials`，并要求 `tenant-id`。

## 创建支付单

`POST /open-api/v1/payments`

需要 `payment:create` scope 和 `Idempotency-Key` 请求头。幂等键最多 128 个字符。

| 字段 | 类型 | 必填 | 说明 |
|---|---|:---:|---|
| `clientOrderNo` | string | 是 | 第三方业务订单号，最多 128 个字符；在同一 OAuth2 客户端内唯一 |
| `amount` | integer | 是 | 支付金额，人民币分，必须大于 0 |
| `currency` | string | 是 | 币种，首期只支持 `CNY` |
| `subject` | string | 是 | 支付标题，最多 128 个字符 |
| `payerOpenId` | string | 是 | 微信用户 OpenID，最多 128 个字符，必须属于平台选用支付配置的 AppID |

```http
POST /open-api/v1/payments
Authorization: Bearer <access-token>
tenant-id: 1001
Idempotency-Key: order-20261102-001-create
Content-Type: application/json

{
  "clientOrderNo": "order-20261102-001",
  "amount": 12800,
  "currency": "CNY",
  "subject": "订单支付",
  "payerOpenId": "oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"
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

`paymentData` 是微信 JSAPI 调起参数。第三方后端应安全地把它传递给自己的微信 H5/小程序客户端，再由客户端调用对应的微信支付 JSAPI。不要把 `paySign` 或完整支付响应写入普通业务日志。

支付单有效期为创建后 2 小时。微信预支付参数暂时未生成时，接口仍可能返回 `PENDING` 且 `paymentData` 为空对象；使用相同请求内容和相同幂等键重试创建，可继续获取该支付单的调起参数，不会新建另一笔支付单。

同一客户端对同一 `clientOrderNo` 使用相同请求内容和相同幂等键重试，会返回原支付单。订单号已存在但支付内容不同，或订单号绑定了另一个幂等键时返回冲突错误。请为每笔业务订单生成并持久化幂等键；网络超时后重试时不要换键。

## 查询支付单

### 按平台支付单号查询

`GET /open-api/v1/payments/{paymentId}`

需要 `payment:read` scope。

```http
GET /open-api/v1/payments/1969876543210000001
Authorization: Bearer <access-token>
tenant-id: 1001
```

### 按第三方订单号查询

`GET /open-api/v1/payments/by-client-order/{clientOrderNo}`

需要 `payment:read` scope。`clientOrderNo` 应按 URL 路径段进行编码。

两个查询接口返回与创建接口相同的支付单字段。对于 `PENDING` 支付，平台会尝试向微信查询最新状态；退款为 `PROCESSING` 时，平台会尝试刷新退款状态。支付成功以平台确认的状态为准，不要仅凭客户端支付 SDK 的回调判断成功。

## 申请全额退款

`POST /open-api/v1/payments/{paymentId}/refund`

需要 `payment:refund` scope 和独立的退款 `Idempotency-Key`。只支持已支付订单的全额原路退款，不接收退款金额。请求体可省略；`reason` 可选，最多 256 个字符。

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

响应仍为支付单对象，其中 `refundStatus` 表示退款进度。`PROCESSING` 仅表示平台已提交退款，不代表微信已完成退款；继续查询支付单，直到得到 `SUCCESS` 或 `FAILED`。退款处理中或已成功时，只能使用原退款幂等键重复提交；不同键会被拒绝。

## 状态字段

### 支付状态 `status`

| 值 | 含义 |
|---|---|
| `PENDING` | 等待支付结果 |
| `SUCCESS` | 平台已确认支付成功 |
| `FAILED` | 微信返回支付失败 |
| `CLOSED` | 支付单已关闭 |

### 退款状态 `refundStatus`

| 值 | 含义 |
|---|---|
| `NOT_REFUNDED` | 尚未退款 |
| `PROCESSING` | 退款处理中 |
| `SUCCESS` | 平台已确认全额退款成功 |
| `FAILED` | 退款失败或异常结束 |

时间字段 `expireTime`、`paidTime`、`refundTime` 可能为空；除 `expireTime` 外，支付或退款尚未进入对应终态时相关时间为空。

## 支付结果 Webhook

管理员在当前租户的微信支付配置中维护 Webhook 地址。支付状态变化后，平台向该地址发送明文 JSON `POST`；不添加应用层签名或加密。生产环境请配置 HTTPS 接收地址。

```http
POST <支付配置中维护的 Webhook URL>
Content-Type: application/json; charset=utf-8
X-OpenAPI-Event-Id: <eventId>

{
  "eventId": "4d2e3ea100004...",
  "eventType": "payment.succeeded",
  "paymentId": "1969876543210000001",
  "clientOrderNo": "order-20261102-001",
  "status": "SUCCESS",
  "refundStatus": "NOT_REFUNDED",
  "amount": 12800,
  "currency": "CNY",
  "occurredAt": "2026-11-02T18:20:00"
}
```

当前事件类型：`payment.succeeded`、`payment.failed`、`payment.closed`、`payment.refunded`。接收端应先持久化事件，再返回任意 `2xx`；用 `eventId` 做幂等去重。平台按至少一次方式投递，同一事件可能重复到达，事件 ID 在重试时保持不变。

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
| `2026110216` | 原支付单使用的微信支付配置不可用 |
| `2026110217` | 租户未配置唯一启用的微信 JSAPI OpenAPI 支付配置 |
| `2026110218` | OpenAPI 访问令牌无效 |

收到令牌缺失、过期或无效错误时，重新申请令牌。创建支付或退款遇到超时、连接中断或 5xx 时，先使用原幂等键重试或查询，不要换键重复创建交易。

## 首期范围

首期支持微信 JSAPI 支付创建、支付查询、全额原路退款和支付结果 Webhook。当前不提供商家转账、用户确认收款、部分退款、支付宝/汇付渠道接入或平台托管收银页面。
