# 支付接口（App 端）

> 本文是订单支付的前端接口参考。接口统一使用 `/app-api` 前缀，业务接口返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功。
>
> 支付配置、商户证书、API 密钥和支付回调地址均由服务端维护，前端不传商户号、密钥或支付金额。

## 适用范围

本文面向小程序、公众号和 H5 前端开发者，覆盖普通订单支付和后续小程序接入所需的拼单支付契约：

- 使用订单号发起微信、余额、支付宝或 Adapay 支付；
- 根据不同渠道的返回值调起前端支付；
- 支付完成后确认业务订单状态；
- 提交退款申请并展示退款状态；
- 为同一订单发起多笔 Adapay 支付，并按支付份数汇总拼单进度。

拼单支付本期仅支持 Adapay，且不允许游客支付。普通订单的既有支付渠道规则仍按租户现有配置执行；本文中“拼单”专指 `groupStatus` 为 `1` 或 `2` 的订单。

支付模块的内部 `PayOrderApi` 不属于前端接口，客户端不要直接调用支付模块内部地址。

## 支付流程

```text
查询订单 → 确认 paid=0 → POST /app-api/order/pay
    ├─ 普通订单：使用配置的支付渠道调起支付
    ├─ 拼单订单：使用 Adapay 支付 1 份或多份
    └─ 余额：服务端同步扣款
支付操作结束 → GET /app-api/order/detail/{orderId}
    └─ 普通订单 paid=1；拼单订单 groupStatus=2 且 groupPaidCount=groupTotalCount 后才进入履约
```

支付平台回调和前端支付结果不是同一件事。前端支付 SDK 返回成功后，仍必须重新查询订单详情；普通订单以 `paid = 1` 确认业务订单已支付，拼单订单还必须确认 `groupStatus = 2` 且 `groupPaidCount = groupTotalCount`。

## 支付接口 `POST /app-api/order/pay`

需要登录，请求头为 `Authorization: Bearer <token>`。`uni` 应使用订单列表或订单详情返回的 `orderId`；也兼容订单的 `unique`。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| uni | string | **是** | 订单号或订单唯一值；不要传客户端自行生成的编号 |
| from | string | 否 | 支付来源；小程序传 `routine`，公众号传 `wechat`，H5 传 `h5` |
| paytype | string | **是** | `weixin` 微信、`yue` 余额、`alipay` 支付宝、`adapay` Adapay |
| authCode | string | 否 | 付款码支付预留参数；普通小程序、公众号和 H5 支付不传 |
| shareCount | int | 否 | 本次拼单支付份数，默认 1；普通订单忽略。拼单时必须为正整数且不能超过剩余份数 |

服务端从订单读取商品标题。普通订单从订单读取实际应付金额；拼单订单根据订单总金额、总份数和本次 `shareCount` 计算本次应付金额，前端不传金额。普通订单只有 `paid = 0` 时允许支付；拼单订单在未过期且仍有剩余份数时允许继续支付。

拼单时，一次请求的 `shareCount` 表示同一笔 AdaPay 支付包含的份数，因此一次响应只会有一个 `data.data.order_no`。例如 `shareCount=2` 时，用户一次支付两份，服务端创建一笔金额为两份合计金额的支付，返回一个支付号；不会为两份分别创建两个 `order_no`。

### 请求示例

```http
POST /app-api/order/pay
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "uni": "202607301200001",
  "from": "routine",
  "paytype": "weixin"
}
```

## 渠道返回值

接口成功时，外层通常为：

```json
{
  "code": 0,
  "msg": "",
  "data": {},
  "trade_type": "JSAPI"
}
```

`data` 的结构由支付渠道和租户配置决定，前端不要把它转换成固定的订单对象。

### 微信小程序 `paytype=weixin&from=routine`

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "timeStamp": "1785384000",
    "nonceStr": "4f3c9d8e7a6b5c4d",
    "package": "prepay_id=wx202607301200001",
    "signType": "RSA",
    "paySign": "签名内容"
  },
  "trade_type": "JSAPI"
}
```

将 `data` 原样展开传给微信小程序支付 API：

```js
wx.requestPayment({
  ...response.data,
  success: () => refreshOrderDetail(),
  fail: () => refreshOrderDetail()
})
```

无论支付 SDK 成功还是取消，都应重新查询订单详情，避免仅依赖前端回调判断支付状态。

### 微信公众号 `paytype=weixin&from=wechat`

返回 `data` 为公众号 JSAPI 所需的支付参数，`trade_type` 为 `W-JSAPI`。前端按公众号 JSAPI SDK 的参数格式调起支付，处理方式与小程序相同：完成或取消后重新查询订单。

### 微信 H5 `paytype=weixin&from=h5`

返回 `data` 为微信 H5 支付跳转地址，`trade_type` 为 `MWEB`。前端跳转到该地址完成支付；回到业务页面后重新查询订单详情确认 `paid = 1`。

### 余额支付 `paytype=yue`

余额支付不调用外部支付平台，不产生支付回调或 `outPayNo`，服务端校验余额后同步扣款并完成订单支付。

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "status": "ok"
  }
}
```

余额不足、用户无效或订单已支付时，接口返回业务错误；前端直接展示 `msg`，不要重复扣款式重试。

### 支付宝 `paytype=alipay`

当前订单支付流程使用支付宝 H5 支付。成功响应中的 `data` 为渠道调起所需的支付内容，具体是跳转地址还是表单内容以租户支付宝配置和实际响应为准。前端完成调起后，仍通过订单详情确认 `paid = 1`。

### Adapay `paytype=adapay`

Adapay 小程序支付返回 Adapay 支付结果结构，微信小程序支付参数嵌套在 `expend.pay_info` 中，并且 `pay_info` 的类型是 JSON 字符串，不是对象。返回结构中的 `order_no` 是 AdaPay 本次支付的外部支付单号；拼单场景仍沿用原有字段，不新增 `outPayNo` 返回字段。

以下是脱敏后的典型响应结构：

以下示例为拼单订单；普通订单不会返回拼单专用的序号和份数字段。返回中的 `data.data.order_no` 是本次 AdaPay 支付的三段式外部支付单号，系统主订单号仍对应请求中的 `uni`（或订单详情中的 `orderId`）。

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "data": {
      "order_no": "{orderId}-{groupMemberNo}-{payAttemptNo}",
      "sdk_status": "PAY_SUCCESS",
      "pay_amt": "0.60",
      "pay_channel": "wx_lite",
      "expend": {
        "pay_info": "{\"timeStamp\":\"...\",\"package\":\"prepay_id=...\",\"paySign\":\"...\",\"appId\":\"...\",\"signType\":\"RSA\",\"nonceStr\":\"...\"}",
        "token_id": "..."
      },
      "status": "succeeded"
    },
    "groupMemberNo": 2,
    "payAttemptNo": 1,
    "shareCount": 1,
    "payAmount": 0.33
  }
}
```

对于普通订单，返回的 `order_no` 仍是 AdaPay 外部支付单号，例如 `202607301200001-1-1`；系统主订单号是请求中的 `uni`。服务端传给 AdaPay 的支付单号和返回的 `order_no` 使用同一个值，历史两段式外部支付单号不修改。

其中 `pay_info` 解析后才是微信小程序 `wx.requestPayment` 所需的参数：

```json
{
  "timeStamp": "...",
  "nonceStr": "...",
  "package": "prepay_id=...",
  "signType": "RSA",
  "paySign": "...",
  "appId": "..."
}
```

#### 使用小程序请求封装

`miniapp/utils/request.js` 会去掉最外层 `code` 和 `msg`，因此调用方收到的是 `CommonResult.data`，取值路径为 `result.data.expend.pay_info`：

```js
const result = await request({
  url: '/app-api/order/pay',
  method: 'POST',
  data: {
    uni: orderId,
    from: 'routine',
    paytype: 'adapay'
  },
  loadingText: '发起支付中...'
});

const payInfoText = result?.data?.expend?.pay_info;
if (typeof payInfoText !== 'string' || !payInfoText) {
  throw new Error('Adapay 支付参数缺失');
}

const paymentParams = JSON.parse(payInfoText);
wx.requestPayment({
  ...paymentParams,
  success: () => pollOrderStatus(orderId),
  fail: () => pollOrderStatus(orderId)
});
```

如果使用 `requestRaw` 或直接使用 `wx.request`，则保留完整响应，取值路径为：

```js
const payInfoText = response.data.data.expend.pay_info;
const paymentParams = JSON.parse(payInfoText);
```

`timeStamp`、`nonceStr`、`package`、`signType`、`paySign` 和 `appId` 应原样传给微信支付 SDK。不要把 `pay_info`、`token_id` 或签名内容写入日志、缓存或业务数据库。

#### 状态判断

`sdk_status=PAY_SUCCESS` 和 `status=succeeded` 表示 Adapay 已成功生成支付对象及小程序调起参数，不代表用户已经在微信中完成付款。前端不得因为接口 `code=0`、`sdk_status=PAY_SUCCESS` 或 Adapay `status=succeeded` 就展示“支付成功”。

正确流程是：

```text
发起 Adapay 支付
    → JSON.parse(expend.pay_info)
    → wx.requestPayment(paymentParams)
    → 支付完成或取消
    → GET /app-api/order/detail/{orderId}
    → 只有 paid=1 才展示支付成功
```

服务端收到 Adapay 成功回调后，会通过支付通知流程更新本地订单。若第三方响应显示成功但订单详情仍为 `paid=0`，不要手动把订单标记为已支付；应检查支付回调地址、回调日志和支付通知消费状态。

如果门店启用了 Adapay 延迟分账，服务端会在支付前校验平台和门店收款人配置；配置不完整时支付会被拒绝，前端展示服务端错误信息即可。

### 其他支付方式

`cash` 仅用于特定线下或后台业务，不属于普通 C 端支付流程。`integral` 等枚举值不应作为本接口的通用支付方式传入。拼单订单不得使用微信、支付宝、余额或现金支付，只能使用 Adapay。

## 拼单支付规则

拼单支付复用 `/app-api/order/pay`，不新增支付接口：

- 发起人必须先支付 1 份；首份支付成功后开始计算租户配置的付款时限。
- 其他已登录用户可以支付剩余 1 份或多份，同一用户可以多次支付；游客不能支付。
- 每次支付请求只创建一笔 Adapay 支付，`shareCount` 表示该笔支付包含的份数，所以一次请求只对应一个 `order_no`。
- 每创建一次支付尝试，`payAttemptNo` 就递增一次，包括支付失败、取消或关闭的尝试；它不表示成功支付次数。重试会返回新的 `order_no`，不同支付人的支付尝试也各自有独立的 `order_no`。
- 服务端按主订单行锁预占剩余份数，不能超额支付。支付失败或取消后重试会创建新的支付尝试。
- 金额按主订单 `payPrice` 平均拆分，允许金额尾差，尾差计入最后一份。
- 订单达到 `groupTotalCount` 后设置 `groupStatus=2`、`paid=1`，才继续原订单履约流程。
- 订单创建后不能修改拼单总份数；如需修改，发起人必须先取消订单。

拼单支付示例：

```json
{
  "uni": "202607301200001",
  "from": "routine",
  "paytype": "adapay",
  "shareCount": 2
}
```

成功响应中的 `data` 包含原有 Adapay 支付结果和本次尝试的标识：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "data": { "order_no": "202607301200001-2-1", "pay_amt": "0.66" },
    "groupMemberNo": 2,
    "payAttemptNo": 1,
    "shareCount": 2,
    "payAmount": 0.66
  }
}
```

多个支付尝试的关系示例：

| 支付动作 | `shareCount` | 本次 `order_no` | 说明 |
|---|---:|---|---|
| 发起人首次支付成功 | 1 | `202607301200001-1-1` | 发起人必须先支付一份 |
| 用户 2 首次发起后取消 | 1 | `202607301200001-2-1` | 已创建支付尝试，但不计入成功份数 |
| 用户 2 第二次发起并支付两份 | 2 | `202607301200001-2-2` | 取消的尝试也占用过序号，不复用上一次支付号 |
| 用户 3 首次支付一份 | 1 | `202607301200001-3-1` | 新支付人使用新的拼单人序号 |

客户端不需要收集或拼接这些 `order_no`。发起支付时只传主订单号 `uni` 和本次 `shareCount`；当前响应中的 `data.data.order_no` 只用于当前这笔 AdaPay 支付及回调匹配，最终拼单进度以订单详情中的 `groupPaidCount` 和 `groupStatus` 为准。

## 支付渠道锁定

普通订单一旦存在未关闭的第三方支付尝试，服务端会锁定支付渠道，不能直接切换到另一渠道。拼单订单固定使用 Adapay，不存在跨渠道切换；每个支付人自己的未完成支付尝试会在重试前关闭，不影响其他支付人的支付记录。

遇到“订单已使用其他支付渠道发起，无法切换”时：

1. 重新查询订单详情，确认订单是否已经支付；
2. 若仍未支付，继续使用原支付渠道；
3. 不要在客户端修改订单号或金额来绕过锁定。

Adapay 重新发起支付时由服务端管理新的三段式外部支付单号，前端始终使用同一个业务订单号 `uni`，不要传 `outPayNo`。

## 退款申请 `POST /app-api/order/refund`

需要登录。该接口提交的是用户退款申请，不代表渠道退款已立即完成；是否受理及实际退款由服务端订单流程处理。

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| uni | string | **是** | 订单号或订单唯一值 |
| text | string | **是** | 退款原因 |
| refundReasonWapExplain | string | 否 | 用户补充说明 |
| refundReasonWapImg | string | 否 | 退款凭证图片 URL |

```http
POST /app-api/order/refund
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "uni": "202607301200001",
  "text": "商品未按预期完成",
  "refundReasonWapExplain": "请协助处理",
  "refundReasonWapImg": "https://cdn.example.com/refund.jpg"
}
```

成功表示申请已提交：

```json
{ "code": 0, "msg": "", "data": true }
```

退款状态以订单详情的 `refundStatus` 为准：

| 值 | 含义 |
|----|------|
| 0 | 未退款 |
| 1 | 申请中 |
| 2 | 已退款 |
| 3 | 已拒绝 |

退款金额、支付渠道、部分退款规则均由服务端根据订单处理，前端不要自行计算或直接调用第三方退款接口。

拼单订单仍沿用现有订单规则判断是否可退款，但用户侧只有发起人可以申请整单退款。服务端会查询该订单所有成功的 Adapay 支付尝试，并按每笔支付的 `adapayPaymentId`、`outPayNo` 和 `payAmount` 分别原路退款给对应支付人；参与人不能单独申请退款。

## 支付回调（服务端接口）

```text
/app-api/order/notify/payBack{detailsId}.json
```

该地址由 Adapay（以及普通订单仍配置的其他支付渠道）调用，前端不要请求，也不要把它当作支付状态查询接口。支付成功后的业务订单状态由服务端回调和支付通知流程更新；前端只通过订单详情确认最终状态。拼单回调按 `outPayNo` 定位单笔支付尝试，重复回调必须保持幂等。

余额支付没有外部支付回调。

## 前端对接检查清单

- 支付前使用订单详情的 `paid`、`groupStatus`、`groupPaidCount` 和 `payPrice`，不在客户端改金额。
- `uni` 使用服务端返回的 `orderId`，打印订单也使用其 `orderNo` 作为订单号。
- 第三方支付返回成功、失败或取消后，都重新请求订单详情。
- 普通订单只有 `paid = 1` 才展示支付成功或开始后续履约；拼单订单还必须确认 `groupStatus=2` 且 `groupPaidCount=groupTotalCount`。
- 拼单支付必须使用登录态、`paytype=adapay` 和 `shareCount`；客户端无需自行生成或修改 AdaPay 返回的 `order_no`。
- 退款申请成功后，根据 `refundStatus` 展示“申请中”，不要立即提示“退款完成”。
- 不在前端保存或提交支付密钥、商户证书、`outPayNo` 等服务端支付凭证。
