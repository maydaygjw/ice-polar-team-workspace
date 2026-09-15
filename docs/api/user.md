# 用户个人中心接口（App 端）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案，直接 toast 即可。
>
> 除注明外均需登录，请求头：`Authorization: Bearer <token>`。H5 WebView Ticket 兑换接口不需要登录，详见第 1 节。
>
> 源码：`backend/yshop-module-member/.../controller/app/user/AppUserController.java`、`backend/yshop-module-member/.../controller/app/auth/AppAuthController.java`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/app-api/member/user/get` | 获得用户基本信息（精简） |
| GET | `/app-api/member/user/get-nickname?userId=400` | 获取指定用户昵称 |
| GET | `/app-api/member/user/get-info` | 获得用户完整信息（余额/积分/订单统计等） |
| POST | `/app-api/member/user/update-nickname` | 修改昵称/生日/性别/头像/手机 |
| POST | `/app-api/member/user/update-avatar` | 修改头像（文件上传） |
| POST | `/app-api/member/user/update-mobile` | 修改手机号（短信验证码） |
| GET | `/app-api/member/user/getBill` | 用户账单（余额/积分明细） |
| POST | `/app-api/member/user/recharge` | 余额充值（下单） |
| POST | `/app-api/member/user/buyCard` | 购买会员卡（下单） |
| POST | `/app-api/member/user/generate` | 生成二维码（无需登录） |
| POST | `/app-api/mp/miniapp/qrcode` | 生成临时小程序码（需登录） |
| POST | `/app-api/member/user/generate-mini` | 生成小程序码（无需登录） |
| POST | `/app-api/member/auth/webview-ticket` | 创建 H5 一次性 Ticket（需登录） |
| POST | `/app-api/member/auth/webview-exchange` | 兑换 H5 Ticket 为 backend Token（无需登录） |

---

## 1. H5 WebView 认证

用于小程序或其他已登录客户端打开内部 H5。客户端先用已有 Token 创建一次性 Ticket，H5 打开后立即兑换为 backend Token。

### 1.1 创建 Ticket `POST /app-api/member/auth/webview-ticket`

需要当前会员登录态，请求体为空。

```http
POST /app-api/member/auth/webview-ticket
Authorization: Bearer <miniapp-token>
```

响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "ticket": "c5f2...",
    "expiresIn": 60
  }
}
```

Ticket 只能使用一次，60 秒后过期。不要把 openid、微信 access_token 或 backend Token 放入 H5 URL。

### 1.2 兑换 Token `POST /app-api/member/auth/webview-exchange`

该接口无需登录，身份完全来自一次性 Ticket。H5 页面加载后调用：

```http
POST /app-api/member/auth/webview-exchange
Content-Type: application/json

{"ticket":"c5f2..."}
```

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

兑换成功后，H5 后续请求统一携带：

```http
Authorization: Bearer <accessToken>
```

Ticket 过期、伪造或重复兑换时返回错误码 `1004003007`。兑换接口会根据 Ticket 恢复租户上下文，调用方不应自行传入用户 ID 或租户 ID。

---

## 2. 获得基本信息 `GET /app-api/member/user/get`

返回当前登录用户的精简信息。

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "id": 1001,
    "nickname": "张三",
    "avatar": "/infra/file/get/35a12e57-4297-4faa-bf7d-7ed2f211c952",
    "mobile": "15601691300",
    "birthday": "2023-10-11"
  }
}
```

> `avatar` 可能是相对路径，前端拼接文件服务域名。

---

## 3. 获取指定用户昵称 `GET /app-api/member/user/get-nickname`

根据用户 ID 查询用户昵称，需要登录态。接口只返回昵称，不返回用户其他信息。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| userId | long | **是** | 要查询的用户 ID |

**请求示例**

```http
GET /app-api/member/user/get-nickname?userId=400
Authorization: Bearer <token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": "张三"
}
```

用户不存在时返回用户不存在错误。

---

## 4. 获得完整信息 `GET /app-api/member/user/get-info`

个人中心首页用，含资产、签到、订单统计等。

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "id": 1001,
    "username": "user_1001",
    "account": "user_1001",
    "nickname": "张三",
    "avatar": "/infra/file/get/xxx",
    "mobile": "15601691300",
    "gender": 1,
    "birthday": "2023-10-11",
    "nowMoney": 100.50,
    "sumMoney": 520.00,
    "integral": 300,
    "couponCount": 2,
    "signNum": 5,
    "sumSignDay": 12,
    "isDaySign": 0,
    "isYesterDaySign": 1,
    "checkStatus": 0,
    "spreadUid": 0,
    "spreadCount": 3,
    "isPromoter": 1,
    "payCount": 8,
    "userType": "wechat",
    "loginType": "routine",
    "addres": "",
    "cardId": 1,
    "cardName": "月卡",
    "discount": 95,
    "invitationCode": "A1B2C3",
    "statu": 1,
    "createTime": "2023-06-18 10:00:00",
    "orderStatusNum": {
      "orderCount": 8,
      "sumPrice": 520.0,
      "unpaidCount": 0,
      "unshippedCount": 1,
      "receivedCount": 2,
      "evaluatedCount": 1,
      "completeCount": 4,
      "refundCount": 0
    }
  }
}
```

**字段说明**

| 字段 | 类型 | 说明 |
|------|------|------|
| nowMoney | number | 用户余额 |
| sumMoney | number | 累计消费金额 |
| integral | number | 剩余积分 |
| couponCount | number | 优惠券数量 |
| signNum | int | 连续签到天数 |
| sumSignDay | number | 累计签到天数 |
| isDaySign / isYesterDaySign | int | 今天/昨天是否已签到（1 是 0 否） |
| checkStatus | int | 是否有核销权限 |
| isPromoter | int | 是否推广员 |
| spreadUid / spreadCount | 上级推广人 id / 下级人数 |
| userType | string | 用户类型（h5 / wechat / routine） |
| loginType | string | 登录方式（h5 / wechat / routine 小程序） |
| cardId / cardName / discount | 当前会员卡 id、名称、折扣（如 95 = 95 折） |
| orderStatusNum.orderCount | number | 已支付未退款订单数 |
| orderStatusNum.sumPrice | number | 已支付未退款总金额 |
| orderStatusNum.unpaidCount | number | 待支付 |
| orderStatusNum.unshippedCount | number | 待发货 |
| orderStatusNum.receivedCount | number | 待收货 |
| orderStatusNum.evaluatedCount | number | 待评价 |
| orderStatusNum.completeCount | number | 已完成 |
| orderStatusNum.refundCount | number | 退款中 |

---

## 5. 修改昵称/生日/性别/头像/手机 `POST /app-api/member/user/update-nickname`

JSON body：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | **是** | 用户昵称 |
| birthday | string | **是** | 生日，格式 `yyyy-MM-dd` |
| gender | int | 否 | 性别（0 未知 1 男 2 女） |
| avatar | string | 否 | 头像 URL |
| mobile | string | 否 | 手机号 |

**请求样例**

```json
{
  "nickname": "wang",
  "birthday": "2023-11-12",
  "gender": 1,
  "avatar": "https://.../a.jpg",
  "mobile": "13800138000"
}
```

**响应**：`{ "code": 0, "data": true, "msg": "" }`

**注意**：nickname、birthday 为 `@NotBlank`，只想改头像/性别也必须把这两个带上（先调 `get` 回填）。可选字段不传（null）时 `updateById` 不覆盖旧值。

---

## 6. 修改头像 `POST /app-api/member/user/update-avatar`

multipart 表单上传，字段名 `avatarFile`。`data` 为头像路径。

```bash
curl -X POST 'https://<host>/app-api/member/user/update-avatar' \
  -H 'Authorization: Bearer <token>' \
  -F 'avatarFile=@/path/avatar.jpg'
```

**响应**

```json
{ "code": 0, "data": "/infra/file/get/xxx.jpg", "msg": "" }
```

---

## 7. 修改手机号 `POST /app-api/member/user/update-mobile`

换绑手机号，新旧手机号都需通过短信验证码（场景：`MEMBER_UPDATE_MOBILE`，先调短信发送接口）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | **是** | 新手机验证码，4–6 位数字 |
| mobile | string | **是** | 新手机号，8–11 位 |
| oldCode | string | **是** | 原手机验证码，4–6 位数字 |
| oldMobile | string | **是** | 原手机号，8–11 位 |

**请求样例**

```json
{
  "code": "1234",
  "mobile": "15823654487",
  "oldCode": "1024",
  "oldMobile": "13800138000"
}
```

**响应**：`{ "code": 0, "data": true, "msg": "" }`

---

## 8. 用户账单 `GET /app-api/member/user/getBill`

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| cate | int | 0 | 类别：0 余额，1 积分 |
| type | int | 0 | 类型：0 全部，1 消费，2 充值，3 退款 |
| page | int | 1 | 页码 |
| pagesize | int | 10 | 每页条数 |

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 100,
      "uid": 1001,
      "linkId": "202607301200001",
      "pm": 0,
      "title": "购买商品",
      "category": "now_money",
      "type": "pay_order",
      "number": 20.00,
      "balance": 80.50,
      "mark": "订单支付",
      "status": 1,
      "createTime": "2026-07-30T12:00:00"
    }
  ]
}
```

- `pm`：0 支出，1 获得。
- `status`：0 待确定，1 有效，-1 无效。
- `number` 本次变动金额，`balance` 变动后剩余。

---

## 9. 余额充值 `POST /app-api/member/user/recharge`

创建充值订单，`data` 返回订单 ID，前端拿到后走支付流程。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rechargeId | string | **是** | 充值套餐（面值）ID |

```json
{ "rechargeId": "1" }
```

**响应**：`{ "code": 0, "data": "<orderId>", "msg": "" }`

---

## 10. 购买会员卡 `POST /app-api/member/user/buyCard`

创建会员卡订单，`data` 返回订单 ID，前端走支付流程。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cardId | string | 是 | 会员卡 ID |

```json
{ "cardId": "1" }
```

**响应**：`{ "code": 0, "data": "<orderId>", "msg": "" }`

---

## 11. 生成二维码 `POST /app-api/member/user/generate`

**无需登录**。任意内容生成二维码，返回 base64（JPEG）。

```json
{ "content": "https://example.com/invite?code=A1B2C3" }
```

**响应**：`data` 为 base64 字符串，前端 `data:image/jpeg;base64,<data>` 直接渲染。

---

## 12. 生成临时小程序码 `POST /app-api/mp/miniapp/qrcode`

**需登录**。根据小程序页面路径和场景参数生成小程序码，并上传为临时图片，返回图片 URL 和预期过期时间。

### JSON Body

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| path | string | **是** | 小程序页面路径，不含前导 `/`、查询参数，例如 `pages/index/index` |
| scene | string | **是** | 场景参数，最多 32 个字符；用于在小程序页面中解析业务参数 |

**请求示例**

```http
POST /app-api/mp/miniapp/qrcode
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "path": "pages/index/index",
  "scene": "shopId=123"
}
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "url": "https://oss.example.com/temporary/miniapp-qrcode/xxx.png",
    "expiresAt": "2026-09-09T00:00:00Z"
  }
}
```

| 响应字段 | 类型 | 说明 |
|------|------|------|
| data.url | string | 临时小程序码图片 URL |
| data.expiresAt | string | 业务预期过期时间；实际清理由存储生命周期负责 |

> 图片临时有效期为 48 小时。`path` 不要拼接查询参数，业务参数放入 `scene`。

---

## 13. 生成小程序码 `POST /app-api/member/user/generate-mini`

**无需登录**。生成微信小程序码（`createWxaCodeUnlimit`），返回 base64。

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | scene 参数（标头），最长 32 |
| path | string | 小程序跳转页面路径 |

```json
{ "name": "uid1001", "path": "pages/index/index" }
```

**响应**：`data` 为 base64 字符串；生成失败时 `data` 为 `null`（接口仍返回 code=0，前端需判空）。

> 小程序码环境：后端 `local` profile 生成 develop 版体验码，其他环境生成 release 正式码。

---

## 对接提示

- 「编辑资料」流程：先 `get` 拿当前值回填 → 头像变更先 `update-avatar` 上传拿 URL → 最后 `update-nickname` 提交全部字段。
- 换绑手机号：需先调短信验证码发送接口（scene = MEMBER_UPDATE_MOBILE），新旧手机各发一次，再调 `update-mobile`。
- 充值/买卡只创建订单，支付完成后余额/会员权益由后端支付回调更新，前端轮询 `get-info` 刷新。
- 本地启动后端后可在线查看 API 文档：`http://localhost:8888/doc.html`。
