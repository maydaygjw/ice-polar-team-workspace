# 订单接口（App 端）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案。
>
> 列表、详情、创建、支付及用户订单操作接口均使用登录态，请求头：`Authorization: Bearer <token>`。支付回调由支付平台调用；桌台、共享菜单和同城配送辅助接口按业务场景和网关配置使用。
>
> 支付参数、渠道返回值、支付渠道锁定、拼单支付、退款申请和回调边界见独立文档 [`payment.md`](./payment.md)。
>
> 接口前缀：`/app-api`。源码：`backend/yshop-module-mall/yshop-module-order-biz/.../controller/app/order/AppOrderController.java`

## 常用流程

普通订单：

```text
确认商品/价格 → 创建订单 → 查询订单 → 发起支付 → 查询订单确认 paid=1
```

拼单订单：

```text
创建订单（groupEnabled=true）
  → 发起人使用 Adapay 支付 1 份
  → 分享同一个订单标识给其他已登录用户
  → 参与人使用 Adapay 支付 1 份或多份
  → 查询订单确认 groupPaidCount=groupTotalCount、groupStatus=2、paid=1
```

拼单订单在全部份数支付成功前不会进入后续履约流程。拼单支付仅允许已登录用户，游客不能支付；本期不新增小程序拼单页或分享页，客户端入口由后续小程序需求接入。

打印/设备订单：

```text
POST /app-api/device/printer/order
  → GET /app-api/device/printer/order/list
  → GET /app-api/device/printer/order/detail?orderNo=
  → POST /app-api/order/pay
  → 支付成功后由设备业务继续处理
```

打印订单的创建、专用列表/详情和打印进度见 [`printer.md`](./printer.md)。打印下单返回的 `orderNo` 同时可作为订单模块的 `orderId` 和支付接口的 `uni` 使用。

> 普通 `/app-api/order/list` 和 `/app-api/order/detail/{key}` 仍可查询打印订单的通用订单字段，但不会返回文件、页数、份数、纸张、颜色和链科任务等打印专用信息。

## 接口总览

| 方法 | 路径 | 说明 | 登录 |
|------|------|------|:---:|
| POST | `/app-api/order/getCanUseCoupon` | 查询可用优惠券 | ✅ |
| POST | `/app-api/order/getVipDeduction` | 查询会员折扣金额 | ✅ |
| POST | `/app-api/order/create` | 创建普通订单 | ✅ |
| POST | `/app-api/order/pay` | 发起订单支付 | ✅ |
| GET | `/app-api/order/list` | 查询当前用户订单列表 | ✅ |
| GET | `/app-api/order/detail/{key}` | 查询订单详情 | ✅ |
| POST | `/app-api/order/take` | 确认收货 | ✅ |
| POST | `/app-api/order/refund` | 申请退款 | ✅ |
| POST | `/app-api/order/cancel` | 取消未支付订单 | ✅ |
| POST | `/app-api/order/del` | 删除订单记录 | ✅ |
| POST | `/app-api/order/reply` | 提交单个商品评价 | ✅ |
| POST | `/app-api/order/reply/batch` | 批量提交订单评价 | ✅ |
| GET | `/app-api/order/reply/list` | 查询订单评价 | ✅ |
| POST | `/app-api/order/user_count` | 查询个人中心订单统计 | ✅ |
| POST | `/app-api/order/sync-cart` | 同步共享菜单购物车 | 按场景 |
| GET | `/app-api/order/get-share-cart` | 查询共享菜单 | 按场景 |
| POST | `/app-api/order/samecity/price` | 同城配送预估价 | 按场景 |
| POST | `/app-api/order/notify/payBack{detailsId}.json` | 支付渠道回调 | ❌，支付平台调用 |

---

## 1. 查询订单列表 `GET /app-api/order/list`

查询当前登录用户的订单。打印订单使用 `orderType=device`。

### Query 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| orderType | string | **是** | — | 订单类型：`takein` 自取、`takeout` 外卖、`desk` 扫码点餐、`device` 设备/打印订单 |
| type | int | 否 | `-1` | 状态筛选：`-1` 全部、`0` 待支付、`1` 待发货、`2` 待收货、`3` 待评价、`4` 已完成、`5` 退款中、`6` 已退款、`7` 退款 |
| page | int | 否 | `1` | 页码 |
| limit | int | 否 | `10` | 每页数量 |

### 查询待支付打印订单

```http
GET /app-api/order/list?orderType=device&type=0&page=1&limit=10
Authorization: Bearer <token>
```

### 查询全部打印订单

```http
GET /app-api/order/list?orderType=device&type=-1&page=1&limit=10
Authorization: Bearer <token>
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 10001,
      "orderId": "202607301200001",
      "orderType": "device",
      "shopId": 72,
      "shopName": "西湖文三店",
      "totalNum": 10,
      "totalPrice": 1.00,
      "payPrice": 1.00,
      "paid": 0,
      "payType": null,
      "status": 0,
      "createTime": "2026-07-30 12:00:00",
      "groupStatus": 0,
      "groupTotalCount": null,
      "groupPaidCount": null,
      "groupStartTime": null,
      "groupExpireTime": null,
      "cartInfo": []
    }
  ]
}
```

列表项是 `AppStoreOrderQueryVo`。实际响应可能包含配送、退款、桌台和设备业务相关字段；前端以需要的字段为准。

支付按钮建议只在 `paid = 0` 时展示，并使用列表项的 `orderId` 调支付接口。

---

## 2. 查询订单详情 `GET /app-api/order/detail/{key}`

按订单的 `orderId` 或下单时生成的 `unique` 查询当前用户的订单详情。

```http
GET /app-api/order/detail/202607301200001
Authorization: Bearer <token>
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "id": 10001,
    "orderId": "202607301200001",
    "unique": "202607301200001",
    "orderType": "device",
    "shopId": 72,
    "shopName": "西湖文三店",
    "totalNum": 10,
    "totalPrice": 1.00,
    "payPrice": 1.00,
    "paid": 0,
    "payTime": null,
    "payType": null,
    "status": 0,
    "refundStatus": 0,
    "groupStatus": 1,
    "groupTotalCount": 3,
    "groupPaidCount": 1,
    "groupStartTime": "2026-07-30 12:01:00",
    "groupExpireTime": "2026-07-30 13:01:00",
    "createTime": "2026-07-30 12:00:00",
    "cartInfo": []
  }
}
```

关键字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| orderId | string | 业务订单号，可用于支付、取消、收货和打印进度查询 |
| unique | string | 订单唯一值，部分历史接口使用该值作为订单参数 |
| paid | int | 支付状态：`0` 未支付，`1` 已支付 |
| payPrice | number | 实际应支付金额，以服务端返回值为准 |
| status | int | 订单业务状态，具体展示文案可使用 `statusDto` |
| refundStatus | int | 退款状态：`0` 未退款、`1` 申请中、`2` 已退款、`3` 已拒绝 |
| groupStatus | int | 拼单状态：`0`/`null` 非拼单，`1` 拼单中，`2` 已拼满 |
| groupTotalCount | int | 拼单总份数，包含发起人，范围为 2～10；非拼单为空 |
| groupPaidCount | int | 已成功支付份数；非拼单为空或 0 |
| groupStartTime | string | 首份支付成功时间；拼单首份支付前为空 |
| groupExpireTime | string | 拼单截止时间；由租户分钟参数在首份支付成功时确定 |
| cartInfo | array | 订单商品快照 |

订单不存在时返回错误，不要根据客户端传入的金额自行支付。拼单支付参与人不要求是发起人，但必须使用登录态。

---

## 3. 订单支付 `POST /app-api/order/pay`

创建订单后使用此接口发起支付。打印订单也使用此接口，不要直接调用支付服务内部接口。

### Body 参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| uni | string | **是** | 订单号，推荐传订单列表/详情返回的 `orderId`；也支持订单 `unique` |
| from | string | 否 | 支付来源。小程序传 `routine`，公众号传 `wechat`，H5 传 `h5` |
| paytype | string | **是** | 支付方式：`weixin` 微信、`yue` 余额、`alipay` 支付宝、`adapay` Adapay；以当前租户配置为准 |
| authCode | string | 否 | 付款码支付时使用，普通小程序支付不传 |
| shareCount | int | 否 | 本次拼单支付份数，默认 1；普通订单忽略。拼单时必须为正整数，且不能超过剩余份数 |

### 微信小程序支付

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

**响应样例**

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

`data` 中的字段由微信支付配置决定，前端直接展开传给 `wx.requestPayment`。支付完成后重新查询订单详情，确认 `paid = 1`。

### 余额支付

```json
{
  "uni": "202607301200001",
  "from": "routine",
  "paytype": "yue"
}
```

成功响应示例：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "status": "ok"
  }
}
```

### 拼单 Adapay 支付

拼单支付必须传 `paytype=adapay`，并要求请求用户已登录。发起人首笔支付只能支付 1 份；其他已登录用户可以支付 1 份或多份，同一用户也可以再次支付。多份支付合并为一笔 Adapay 支付，`shareCount` 表示本次支付份数。

```json
{
  "uni": "202607301200001",
  "from": "routine",
  "paytype": "adapay",
  "shareCount": 2
}
```

拼单支付成功创建后，响应中的 `data` 会返回原有的 Adapay 支付结果和本次支付尝试信息：

> 返回中的 `data.data.order_no` 是本次 AdaPay 支付单号，也就是服务端生成的三段式 `outPayNo`；系统主订单号仍是请求中的 `uni`（或订单详情中的 `orderId`）。客户端后续请求继续使用主订单号，不要把 `order_no` 当作主订单号回传。

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "data": {
      "order_no": "202607301200001-2-1",
      "pay_amt": "0.66"
    },
    "groupMemberNo": 2,
    "payAttemptNo": 1,
    "shareCount": 2,
    "payAmount": 0.66
  }
}
```

`data.data.order_no` 是本次 AdaPay 支付的三段式外部支付单号。`groupMemberNo` 是该订单内支付人的序号，发起人固定为 `1`；`payAttemptNo` 是该支付人的支付尝试序号，从 `1` 递增。支付失败或取消后重试会生成新的三段式支付单号，前端始终继续传系统主订单号 `uni`，不要自行拼接或修改支付单号。

### 支付注意事项

- 普通订单只有 `paid = 0` 时允许支付；拼单订单在 `groupStatus = 1` 且未过期、仍有剩余份数时允许继续支付，全部拼满后才变为 `paid = 1`。
- 支付金额以后端订单的 `payPrice` 为准，前端不传金额。
- 同一订单发起第三方支付后，支付渠道可能被锁定；切换渠道前应确认服务端返回结果。
- Adapay 返回成功不等于用户付款成功，必须重新查询详情确认普通订单 `paid = 1`，或拼单订单 `groupStatus = 2` 且 `groupPaidCount = groupTotalCount`。
- 余额支付由服务端同步完成，不产生外部支付回调；成功后仍建议重新查询订单详情。

---

## 4. 创建普通订单 `POST /app-api/order/create`

创建普通商城、外卖、自取、桌台或设备订单。打印业务通常使用专用的 `/app-api/device/printer/order`，不建议前端绕过打印接口直接调用本接口。

### Body 常用字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| orderType | string | 是 | `takein`、`takeout`、`desk`、`device` |
| productId | string[] | 是 | 商品 ID 列表 |
| spec | string[] | 是 | 与 `productId` 一一对应的 SKU 规格 |
| number | string[] | 是 | 与 `productId` 一一对应的购买数量 |
| shopId | string | 否 | 门店 ID |
| addressId | string | 否 | 配送地址 ID |
| mobile | string | 否 | 联系手机号 |
| couponId | string | 否 | 优惠券 ID |
| payType | string | 否 | 下单时选择的支付方式 |
| groupEnabled | boolean | 否 | 是否选择拼单；为 `true` 时必须同时传 `groupTotalCount`，且门店和租户均已启用 |
| groupTotalCount | int | 否 | 拼单总份数，包含发起人，范围为 2～10；订单创建后不可修改 |
| remark | string | 否 | 订单备注，最多 200 个字符 |
| optionSelections | array[] | 否 | 商品选项选择，和商品顺序一一对应；有选项加价时必须传 |
| boxFeeSelected | int[] | 否 | 餐盒选择：`0` 不选、`1` 选择；仅外卖/设备订单生效 |
| cartIds | number[] | 否 | 购物车 ID 列表 |

### 请求样例

```json
{
  "orderType": "takeout",
  "shopId": "72",
  "addressId": "1001",
  "mobile": "13800138000",
  "productId": ["501"],
  "spec": ["默认"],
  "number": ["1"],
  "payType": "weixin",
  "remark": "少冰",
  "couponId": "",
  "optionSelections": [[]],
  "boxFeeSelected": [0]
}
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "orderId": "202607301200001"
  }
}
```

创建接口只负责创建订单；除余额等同步支付方式外，仍需使用 `/app-api/order/pay` 发起支付。

拼单订单创建时应传 `groupEnabled=true`、`groupTotalCount` 和 `payType=adapay`。创建成功后订单为 `groupStatus=1`、`groupPaidCount=0`；发起人首份支付成功后才开始计算拼单有效期。拼单人数不能修改，如需调整必须由发起人先取消原订单后重新创建。

---

## 5. 订单操作

### 确认收货 `POST /app-api/order/take`

```http
POST /app-api/order/take
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "uni": "202607301200001"
}
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 取消未支付订单 `POST /app-api/order/cancel`

```http
POST /app-api/order/cancel
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "id": "202607301200001"
}
```

取消会按服务端规则回退库存、积分和优惠券。只允许取消符合状态要求的订单。

拼单订单只有发起人可以取消。若已有支付成功的拼单份数，取消时会关闭未支付尝试，并将所有已支付份数分别原路退回；订单随后关闭。拼单未满时不能由其他参与人取消。

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 删除订单 `POST /app-api/order/del`

```http
POST /app-api/order/del
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "uni": "202607301200001"
}
```

删除的是当前用户侧订单记录，不代表物理删除支付和设备流水。

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 申请退款 `POST /app-api/order/refund`

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

`text` 和 `uni` 必填，图片和补充说明可选；是否允许退款由订单状态和服务端规则决定。

拼单订单沿用现有可退款状态规则，但用户侧只有发起人可以申请退款。退款按整单处理，所有成功支付尝试分别退回各自的原支付人；参与人不能单独申请退款。

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

---

## 6. 订单评价

### 提交单个评价 `POST /app-api/order/reply`

```http
POST /app-api/order/reply
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "unique": "202607301200001",
  "comment": "服务很好",
  "productScore": "5",
  "serviceScore": "5",
  "pics": "https://cdn.example.com/review.jpg"
}
```

`comment`、`productScore`、`serviceScore`、`unique` 必填；评价内容最多 200 个字符。

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 批量评价 `POST /app-api/order/reply/batch`

```http
POST /app-api/order/reply/batch
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "replyList": [
    {
      "unique": "202607301200001",
      "comment": "服务很好",
      "productScore": "5",
      "serviceScore": "5",
      "pics": ""
    }
  ]
}
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 查询订单评价 `GET /app-api/order/reply/list`

```http
GET /app-api/order/reply/list?oid=10001
Authorization: Bearer <token>
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| oid | long | **是** | 订单数据库 ID，即订单详情的 `id`，不是订单号 `orderId` |

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 301,
      "productId": 501,
      "productScore": 5,
      "serviceScore": 5,
      "comment": "服务很好",
      "pics": [],
      "createTime": "2026-07-30 12:30:00"
    }
  ]
}
```

---

## 7. 个人中心订单统计 `POST /app-api/order/user_count`

```http
POST /app-api/order/user_count
Authorization: Bearer <token>
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "orderCount": 8,
    "sumPrice": 520.0,
    "unpaidCount": 1,
    "unshippedCount": 2,
    "receivedCount": 1,
    "evaluatedCount": 0,
    "completeCount": 4,
    "refundCount": 0
  }
}
```

| 字段 | 说明 |
|------|------|
| orderCount | 已支付且未退款订单数 |
| sumPrice | 已支付且未退款总金额 |
| unpaidCount | 待支付订单数 |
| unshippedCount | 待发货订单数 |
| receivedCount | 待收货订单数 |
| evaluatedCount | 待评价订单数 |
| completeCount | 已完成订单数 |
| refundCount | 退款中订单数 |

---

## 8. 其他辅助接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/app-api/order/getCanUseCoupon` | Body 与创建订单使用同一 `AppOrderParam`，返回当前订单可用优惠券 |
| POST | `/app-api/order/getVipDeduction` | Body 与创建订单使用同一 `AppOrderParam`，返回会员折扣金额 |
| GET | `/app-api/order/getShop?shopId=72&deskId=10` | 查询门店和桌台状态 |
| GET | `/app-api/order/openDesk?shopId=72&deskId=10&people=2` | 开台 |
| GET | `/app-api/order/cancelDue?id=10001` | 取消预约订单，按预约业务使用 |
| GET | `/app-api/order/offPay?id=10001` | 订单线下支付，仅按后台业务授权使用 |
| POST | `/app-api/order/sync-cart` | 同步共享菜单购物车 |
| GET | `/app-api/order/get-share-cart?shopId=72&deskId=10` | 查询共享菜单 |
| POST | `/app-api/order/samecity/price` | 同城配送预估价，Body 与创建订单使用同一 `AppOrderParam` |

这些接口分别服务于门店桌台、共享菜单和同城配送场景；普通订单/打印订单对接时优先使用前文的列表、详情、支付和订单操作接口。

### 查询可用优惠券 `POST /app-api/order/getCanUseCoupon`

**请求样例**

```http
POST /app-api/order/getCanUseCoupon
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "orderType": "takeout",
  "shopId": "72",
  "productId": ["501"],
  "spec": ["默认"],
  "number": ["1"],
  "couponId": "",
  "optionSelections": [[]]
}
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "detailId": 2001,
      "id": 20,
      "couponName": "满 10 减 2",
      "couponValue": 2.00,
      "couponType": 1,
      "threshold": 10.00,
      "discountAmount": 2.00,
      "couponScope": 1
    }
  ]
}
```

### 查询会员折扣 `POST /app-api/order/getVipDeduction`

**请求样例**

```http
POST /app-api/order/getVipDeduction
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "orderType": "takeout",
  "shopId": "72",
  "productId": ["501"],
  "spec": ["默认"],
  "number": ["1"],
  "optionSelections": [[]]
}
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": 1.50 }
```

### 查询门店和桌台状态 `GET /app-api/order/getShop`

**请求样例**

```http
GET /app-api/order/getShop?shopId=72&deskId=10
Authorization: Bearer <token>
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "id": 72,
    "name": "西湖文三店",
    "isEmpty": false,
    "deskOrderId": "202607301200001",
    "deskPeople": 2
  }
}
```

### 开台 `GET /app-api/order/openDesk`

**请求样例**

```http
GET /app-api/order/openDesk?shopId=72&deskId=10&people=2
Authorization: Bearer <token>
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 取消预约 `GET /app-api/order/cancelDue`

**请求样例**

```http
GET /app-api/order/cancelDue?id=10001
Authorization: Bearer <token>
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 订单线下支付 `GET /app-api/order/offPay`

该接口用于特定线下支付业务，普通小程序支付请使用 `/app-api/order/pay`。

**请求样例**

```http
GET /app-api/order/offPay?id=10001
Authorization: Bearer <token>
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 同步共享菜单购物车 `POST /app-api/order/sync-cart`

**请求样例**

```http
POST /app-api/order/sync-cart
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "shopId": 72,
  "deskId": 10,
  "uid": 1001,
  "uName": "张三",
  "content": [
    {
      "id": 501,
      "name": "美式咖啡",
      "price": 18.00,
      "number": 1,
      "boxFeeSelected": 0
    }
  ]
}
```

**响应样例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 查询共享菜单 `GET /app-api/order/get-share-cart`

**请求样例**

```http
GET /app-api/order/get-share-cart?shopId=72&deskId=10
Authorization: Bearer <token>
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 3001,
      "uid": 1001,
      "shopId": 72,
      "uName": "张三",
      "deskId": 10,
      "content": [
        { "id": 501, "name": "美式咖啡", "price": 18.00, "number": 1 }
      ]
    }
  ]
}
```

### 同城配送预估价 `POST /app-api/order/samecity/price`

**请求样例**

```http
POST /app-api/order/samecity/price
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "orderType": "takeout",
  "shopId": "72",
  "addressId": "1001",
  "productId": ["501"],
  "spec": ["默认"],
  "number": ["1"]
}
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "taskId": "TASK202607301200001",
    "deliveryDistance": "3.2km",
    "discountFee": "5.00",
    "expressName": "同城配送",
    "estimateDeliveryTime": "约 35 分钟"
  }
}
```

## 9. 支付回调（服务端接口）

```text
/app-api/order/notify/payBack{detailsId}.json
```

该接口由 Adapay（以及普通订单仍配置的其他支付渠道）调用，前端不要请求，也不要把它当作订单支付状态查询接口。前端支付完成后应调用订单详情接口：普通订单以 `paid` 确认，拼单订单同时确认 `groupStatus` 和 `groupPaidCount`。

## 前端对接要点

- 列表、详情和支付必须使用当前登录用户的 Token。
- 打印订单列表使用 `orderType=device`；待支付筛选使用 `type=0`。
- 支付使用 `orderId` 作为 `uni`，金额和商品信息以服务端订单为准。
- Adapay 支付完成或取消后，重新请求 `/app-api/order/detail/{orderId}`；拼单只有在 `groupStatus=2` 且 `groupPaidCount=groupTotalCount` 后才跳转制作/打印进度页。
- 拼单订单的支付请求必须携带登录态；分享链接本身不代表支付授权。
- 订单列表没有数据时返回 `data: []`，不要把空列表当成接口错误。
- 不要在客户端根据 `totalPrice` 或预览金额自行改写支付金额。
