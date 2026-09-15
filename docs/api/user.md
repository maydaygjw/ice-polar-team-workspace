# 用户个人中心接口（App 端）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案，直接 toast 即可。
>
> 除注明外均需登录，请求头：`Authorization: Bearer <token>`。H5 WebView Ticket 兑换接口不需要登录，详见第 1 节。
>
> 源码：`backend/yshop-module-member/.../controller/app/user/AppUserController.java`、`backend/yshop-module-member/.../controller/app/auth/AppAuthController.java`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/app-api/member/auth/login` | 手机号 + 密码登录 |
| POST | `/app-api/member/auth/logout` | 退出登录 |
| POST | `/app-api/member/auth/refresh-token` | 刷新访问令牌 |
| POST | `/app-api/member/auth/send-sms-code` | 发送短信验证码 |
| POST | `/app-api/member/auth/sms-login` | 手机号 + 短信验证码登录 |
| POST | `/app-api/member/auth/update-password` | 修改密码 |
| POST | `/app-api/member/auth/weixin-mini-app-login` | 微信小程序手机号登录 |
| POST | `/app-api/member/auth/auth-session` | 微信小程序 code 登录 |
| POST | `/app-api/member/auth/auth-miniapp-login-v2` | 微信小程序手机号 code 登录 |
| POST | `/app-api/member/auth/auth-miniapp-login` | 微信小程序旧版登录（已废弃） |
| GET | `/app-api/member/auth/auth-wechat-login` | 微信公众号 code 登录 |
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
| GET | `/app-api/address/city_list` | 获取城市列表（无需登录） |
| POST | `/app-api/address/addAndEdit` | 新增或修改收货地址 |
| POST | `/app-api/address/default/set/{id}` | 设置默认收货地址 |
| POST | `/app-api/address/del/{id}` | 删除收货地址 |
| GET | `/app-api/address/list` | 收货地址列表 |
| POST | `/app-api/address/getDistanceFromLocation` | 计算两点距离（无需登录） |
| POST | `/app-api/system/social-user/bind` | 绑定社交账号 |
| DELETE | `/app-api/system/social-user/unbind` | 解绑社交账号 |
| GET | `/app-api/member/user-level/growthValueConfig` | 会员成长任务配置 |
| GET | `/app-api/member/user-level/levelConfig` | 会员等级列表 |
| GET | `/app-api/member/user-level/levelInfo` | 当前会员等级信息 |
| GET | `/app-api/member/user-level/equity?levelId=1` | 会员等级权益 |
| GET | `/app-api/member/user-level/settleLevelInfo` | 结算时会员等级信息 |
| POST | `/app-api/member/feedback/create` | 提交意见反馈 |
| GET | `/app-api/member/wx-mp/create-jsapi-signature?url=...` | 创建微信公众号 JS-SDK 签名 |
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

## 2. 用户认证

### 2.1 手机号密码登录 `POST /app-api/member/auth/login`

**请求示例**

```http
POST /app-api/member/auth/login
Content-Type: application/json
```

```json
{
  "mobile": "13800138000",
  "password": "password"
}
```

**响应示例**

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

返回 `userId`、`accessToken`、`refreshToken`、`expiresTime` 和用户信息。登录时绑定社交账号，可额外提交 `socialType`、`socialCode`、`socialState`。

### 2.2 退出登录 `POST /app-api/member/auth/logout`

无需强制登录，请求体为空；带上 `Authorization` 时，服务端会注销当前 Token。

**请求示例**

```http
POST /app-api/member/auth/logout
Authorization: Bearer <access-token>
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 2.3 刷新令牌 `POST /app-api/member/auth/refresh-token`

```http
POST /app-api/member/auth/refresh-token?refreshToken=<refresh-token>
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "accessToken": "<new-access-token>",
    "refreshToken": "<new-refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

### 2.4 发送短信验证码 `POST /app-api/member/auth/send-sms-code`

```json
{
  "mobile": "13800138000",
  "scene": 2
}
```

`scene` 使用后端 `SmsSceneEnum`，换绑手机号时使用 `MEMBER_UPDATE_MOBILE` 对应场景值。

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 2.5 短信登录 `POST /app-api/member/auth/sms-login`

```json
{
  "mobile": "13800138000",
  "code": "123456",
  "from": "h5"
}
```

可选传 `openid`、`socialType`、`socialCode`、`socialState` 用于登录后绑定社交账号。

**响应示例**

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

### 2.6 微信小程序登录

#### 手机号 + 登录 code `POST /app-api/member/auth/weixin-mini-app-login`

```json
{
  "phoneCode": "phone-code-from-wx.getPhoneNumber",
  "loginCode": "code-from-wx.login"
}
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "openId": "o_user_openid",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

#### 登录 code 换取会话 `POST /app-api/member/auth/auth-session`

```json
{ "code": "code-from-wx.login" }
```

该接口先通过微信 `code` 换取 `openid`，并缓存小程序会话信息。

**已绑定会员响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "openId": "o_user_openid",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

**未绑定会员响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "openId": "o_new_user_openid"
  }
}
```

- 已绑定 `routine_openid` 的会员：返回 `openId`、`accessToken` 和用户信息，可以直接继续调用业务接口。
- 未绑定手机号或 `routine_openid` 的新用户：当前实现只返回 `openId`，不会创建会员，也不会返回有效 `accessToken`。

因此，当前系统暂不支持“无手机号新用户”的完整小程序登录。新用户需要继续走手机号授权接口；不能直接把 `openId` 当作长期认证 Token。后续业务请求仍使用返回的 `accessToken`。

#### 新版手机号 code 登录 `POST /app-api/member/auth/auth-miniapp-login-v2`

```json
{
  "phoneCode": "phone-code-from-wx.getPhoneNumber",
  "openid": "用户 openid"
}
```

**响应示例**

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

#### 旧版登录 `POST /app-api/member/auth/auth-miniapp-login`

仅为存量客户端兼容保留，已废弃。新客户端不要使用。

**请求示例**

```http
POST /app-api/member/auth/auth-miniapp-login
Content-Type: application/json
```

```json
{
  "encryptedData": "<encrypted-data>",
  "iv": "<iv>",
  "openid": "o_user_openid",
  "invitationCode": "A1B2C3"
}
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "openId": "o_user_openid",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

### 2.7 微信公众号登录 `GET /app-api/member/auth/auth-wechat-login`

```http
GET /app-api/member/auth/auth-wechat-login?code=<wechat-code>&invitationCode=<invitation-code>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1001,
    "openId": "o_user_openid",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresTime": "2026-09-15T12:00:00"
  }
}
```

使用微信公众号授权 `code` 登录并返回会员 Token。

### 2.8 修改密码 `POST /app-api/member/auth/update-password`

需要登录。

```json
{
  "oldPassword": "old-password",
  "password": "new-password"
}
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

## 3. 获得基本信息 `GET /app-api/member/user/get`

返回当前登录用户的精简信息。

**请求示例**

```http
GET /app-api/member/user/get
Authorization: Bearer <access-token>
```

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

## 4. 获取指定用户昵称 `GET /app-api/member/user/get-nickname`

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

## 5. 获得完整信息 `GET /app-api/member/user/get-info`

个人中心首页用，含资产、签到、订单统计等。

**请求示例**

```http
GET /app-api/member/user/get-info
Authorization: Bearer <access-token>
```

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

## 6. 修改昵称/生日/性别/头像/手机 `POST /app-api/member/user/update-nickname`

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

## 7. 修改头像 `POST /app-api/member/user/update-avatar`

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

## 8. 修改手机号 `POST /app-api/member/user/update-mobile`

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

## 9. 用户账单 `GET /app-api/member/user/getBill`

**Query 参数**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| cate | int | 0 | 类别：0 余额，1 积分 |
| type | int | 0 | 类型：0 全部，1 消费，2 充值，3 退款 |
| page | int | 1 | 页码 |
| pagesize | int | 10 | 每页条数 |

**请求示例**

```http
GET /app-api/member/user/getBill?cate=0&type=0&page=1&pagesize=10
Authorization: Bearer <access-token>
```

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

## 10. 余额充值 `POST /app-api/member/user/recharge`

创建充值订单，`data` 返回订单 ID，前端拿到后走支付流程。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rechargeId | string | **是** | 充值套餐（面值）ID |

```json
{ "rechargeId": "1" }
```

**响应**：`{ "code": 0, "data": "<orderId>", "msg": "" }`

---

## 11. 购买会员卡 `POST /app-api/member/user/buyCard`

创建会员卡订单，`data` 返回订单 ID，前端走支付流程。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| cardId | string | 是 | 会员卡 ID |

```json
{ "cardId": "1" }
```

**响应**：`{ "code": 0, "data": "<orderId>", "msg": "" }`

---

## 12. 生成二维码 `POST /app-api/member/user/generate`

**无需登录**。任意内容生成二维码，返回 base64（JPEG）。

```json
{ "content": "https://example.com/invite?code=A1B2C3" }
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": "<base64-jpeg-data>"
}
```

`data` 为 base64 字符串，前端使用 `data:image/jpeg;base64,<data>` 直接渲染。

---

## 13. 生成临时小程序码 `POST /app-api/mp/miniapp/qrcode`

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

## 14. 生成小程序码 `POST /app-api/member/user/generate-mini`

**无需登录**。生成微信小程序码（`createWxaCodeUnlimit`），返回 base64。

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | scene 参数（标头），最长 32 |
| path | string | 小程序跳转页面路径 |

```json
{ "name": "uid1001", "path": "pages/index/index" }
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": "<base64-miniapp-code-data>"
}
```

**响应**：`data` 为 base64 字符串；生成失败时 `data` 为 `null`（接口仍返回 code=0，前端需判空）。

> 小程序码环境：后端 `local` profile 生成 develop 版体验码，其他环境生成 release 正式码。

---

## 15. 收货地址

> 地址 Controller 的路径前缀是 `/address`，完整路径为 `/app-api/address/...`，不是 `/app-api/member/address/...`。

### 15.1 城市列表 `GET /app-api/address/city_list`

无需登录，返回中国省级城市树。

**请求示例**

```http
GET /app-api/address/city_list
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 110000,
      "name": "北京市",
      "children": []
    }
  ]
}
```

### 15.2 新增或修改地址 `POST /app-api/address/addAndEdit`

需要登录。传入 `id` 时修改已有地址，不传时新增。

```json
{
  "id": "",
  "realName": "张三",
  "postCode": "200000",
  "isDefault": 1,
  "detail": "XX路 1 号",
  "phone": "13800138000",
  "address": "上海市浦东新区",
  "longitude": "121.4737",
  "latitude": "31.2304",
  "destinationId": 1,
  "businessRegionId": 1,
  "province": "上海市",
  "city": "上海市",
  "district": "浦东新区"
}
```

**请求示例**

```http
POST /app-api/address/addAndEdit
Authorization: Bearer <access-token>
Content-Type: application/json
```

上面的 JSON 作为请求体传入。新增时 `id` 可不传，修改时传已有地址 ID。

**响应示例**

```json
{ "code": 0, "msg": "", "data": 10001 }
```

### 15.3 设置默认地址 `POST /app-api/address/default/set/{id}`

需要登录，`id` 为地址 ID。

**请求示例**

```http
POST /app-api/address/default/set/10001
Authorization: Bearer <access-token>
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 15.4 删除地址 `POST /app-api/address/del/{id}`

需要登录，`id` 为地址 ID。

**请求示例**

```http
POST /app-api/address/del/10001
Authorization: Bearer <access-token>
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 15.5 地址列表 `GET /app-api/address/list`

需要登录。

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | int | 1 | 页码 |
| limit | int | 10 | 每页条数 |
| businessRegionId | long | - | 商圈 ID，可选 |

**请求示例**

```http
GET /app-api/address/list?page=1&limit=10&businessRegionId=1
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 10001,
      "uid": 1001,
      "realName": "张三",
      "phone": "13800138000",
      "address": "上海市浦东新区",
      "province": "上海市",
      "city": "上海市",
      "district": "浦东新区",
      "detail": "XX路 1 号",
      "longitude": "121.4737",
      "latitude": "31.2304",
      "isDefault": 1,
      "businessRegionId": 1,
      "destinationId": 1,
      "destination": null
    }
  ]
}
```

### 15.6 计算距离 `POST /app-api/address/getDistanceFromLocation`

无需登录。请求体包含 `lat`、`lng`、`lat2`、`lng2`，返回距离数值。

```json
{
  "lat": 31.2304,
  "lng": 121.4737,
  "lat2": 31.2200,
  "lng2": 121.4800
}
```

**请求示例**

```http
POST /app-api/address/getDistanceFromLocation
Content-Type: application/json
```

上面的 JSON 作为请求体传入。

**响应示例**

```json
{ "code": 0, "msg": "", "data": 1234.56 }
```

---

## 16. 社交账号绑定

### 16.1 绑定 `POST /app-api/system/social-user/bind`

需要登录，使用第三方授权 `code + state` 绑定账号。

```json
{
  "type": 31,
  "code": "wechat-authorize-code",
  "state": "state"
}
```

`type` 使用 `SocialTypeEnum`，例如微信公众号 `31`、微信开放平台 `32`、微信小程序 `34`。

**请求示例**

```http
POST /app-api/system/social-user/bind
Authorization: Bearer <access-token>
Content-Type: application/json
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

### 16.2 解绑 `DELETE /app-api/system/social-user/unbind`

需要登录。

```json
{
  "type": 31,
  "openid": "用户 openid"
}
```

**请求示例**

```http
DELETE /app-api/system/social-user/unbind
Authorization: Bearer <access-token>
Content-Type: application/json
```

**响应示例**

```json
{ "code": 0, "msg": "", "data": true }
```

---

## 17. 会员等级

以下接口均需登录。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/app-api/member/user-level/growthValueConfig` | 成长任务配置 |
| GET | `/app-api/member/user-level/levelConfig` | 启用中的等级列表 |
| GET | `/app-api/member/user-level/levelInfo` | 当前等级、下一等级和成长值 |
| GET | `/app-api/member/user-level/equity?levelId=1` | 指定等级权益 |
| GET | `/app-api/member/user-level/settleLevelInfo` | 结算时折扣、包邮和 VIP 信息 |

### 17.1 成长任务配置 `GET /app-api/member/user-level/growthValueConfig`

**请求示例**

```http
GET /app-api/member/user-level/growthValueConfig
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "consumeGrowthValue": 10,
    "inviteGrowthValue": 20
  }
}
```

### 17.2 等级列表 `GET /app-api/member/user-level/levelConfig`

**请求示例**

```http
GET /app-api/member/user-level/levelConfig
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 1,
      "levelName": "普通会员",
      "level": 1,
      "growthValue": 0,
      "iconUrl": "https://example.com/level-1.png",
      "backgroundUrl": "https://example.com/level-1-bg.png",
      "status": true,
      "remarks": "默认等级",
      "colorNum": "#999999",
      "levelEquityList": []
    }
  ]
}
```

### 17.3 当前等级信息 `GET /app-api/member/user-level/levelInfo`

**请求示例**

```http
GET /app-api/member/user-level/levelInfo
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "currentLevel": {
      "id": 1,
      "levelName": "普通会员",
      "level": 1,
      "growthValue": 0
    },
    "nextLevel": {
      "id": 2,
      "levelName": "银卡会员",
      "level": 2,
      "growthValue": 1000
    },
    "currentGrowthValue": 280,
    "needGrowthValue": 720
  }
}
```

### 17.4 等级权益 `GET /app-api/member/user-level/equity`

**请求示例**

```http
GET /app-api/member/user-level/equity?levelId=1
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 1,
      "type": "discount",
      "typeName": "会员折扣",
      "iconUrl": "https://example.com/discount.png",
      "equityValue": 95,
      "remarks": "享 95 折",
      "createTime": "2026-09-16T10:00:00"
    }
  ]
}
```

### 17.5 结算等级信息 `GET /app-api/member/user-level/settleLevelInfo`

**请求示例**

```http
GET /app-api/member/user-level/settleLevelInfo
Authorization: Bearer <access-token>
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "freeShipping": true,
    "discount": 0.95,
    "isVip": true
  }
}
```

---

## 18. 意见反馈 `POST /app-api/member/feedback/create`

需要登录。

**请求示例**

```http
POST /app-api/member/feedback/create
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "bizType": 1,
  "shopId": 73,
  "content": "门店排队时间太长了",
  "imageUrls": ["https://example.com/feedback.jpg"],
  "contactMobile": "13800138000"
}
```

`content` 最多 500 个字符，`imageUrls` 最多 3 张，`bizType` 使用后端 `FeedbackBizTypeEnum`。

**响应示例**

```json
{ "code": 0, "msg": "", "data": 20001 }
```

---

## 19. 微信公众号 JS-SDK 签名 `GET /app-api/member/wx-mp/create-jsapi-signature`

无需登录，传入当前页面完整 URL：

```http
GET /app-api/member/wx-mp/create-jsapi-signature?url=https%3A%2F%2Fexample.com%2Fpage
```

**响应示例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "appId": "wx1234567890",
    "timestamp": 1726459200,
    "nonceStr": "abc123xyz",
    "signature": "<signature>",
    "url": "https://example.com/page"
  }
}
```

返回微信 `WxJsapiSignature`，用于公众号 JS-SDK 初始化。

## 对接提示

- 「编辑资料」流程：先 `get` 拿当前值回填 → 头像变更先 `update-avatar` 上传拿 URL → 最后 `update-nickname` 提交全部字段。
- 换绑手机号：需先调短信验证码发送接口（scene = MEMBER_UPDATE_MOBILE），新旧手机各发一次，再调 `update-mobile`。
- 充值/买卡只创建订单，支付完成后余额/会员权益由后端支付回调更新，前端轮询 `get-info` 刷新。
- 本地启动后端后可在线查看 API 文档：`http://localhost:8888/doc.html`。
