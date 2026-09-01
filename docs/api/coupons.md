# 商品优惠券接口（App 端）

> 本文是商品优惠券的前端接口参考。接口统一使用 `/app-api` 前缀，返回 `CommonResult`：`{ code, msg, data }`；`code = 0` 表示成功。
>
> 除特别注明外，领取和查询用户优惠券的接口均需登录，请求头为 `Authorization: Bearer <token>`。
>
> 后端源码：`backend/yshop-module-marketing/yshop-module-coupon-biz/src/main/java/co/yixiang/yshop/module/coupon/controller/app/`

## 接口总览

| 方法 | 路径 | 登录 | 成功时 `data` 类型 | 说明 |
|------|------|:---:|------|------|
| GET | `/app-api/product/coupon/receive-list` | 否 | `AppCouponDetailRespVO[]` | 查询商品和店铺可领取的商品优惠券 |
| GET | `/app-api/product/coupon/list` | 否 | `PageResult<CanvasProductCouponRespVO>` | 查询商品优惠券列表 |
| GET | `/app-api/product/coupon/relation/receive/{id}` | 是 | `boolean` | 按优惠券 ID 领取商品优惠券 |
| GET | `/app-api/product/coupon/relation/receive/cdkey/{code}` | 是 | `UserCouponVO` | 按兑换码领取并返回刚领取的商品优惠券信息 |
| GET | `/app-api/product/coupon/relation/searchUserCoupon/{type}` | 是 | `UserCouponVO[]` | 查询当前用户的商品优惠券 |

## 1. 查询可领取商品优惠券

### `GET /app-api/product/coupon/receive-list`

根据店铺和商品查询当前可领取的商品优惠券。登录用户已领取的优惠券会被过滤或标记，游客可查询公开的可领取优惠券。

### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| productId | long | 是 | 商品 ID |
| shopId | long | 是 | 店铺 ID |

### 请求示例

```http
GET /app-api/product/coupon/receive-list?productId=1001&shopId=2001
```

### 响应示例

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 3001,
      "couponName": "满 10 减 2",
      "couponKind": 1,
      "couponValue": 2.00,
      "couponType": 1,
      "threshold": 10.00,
      "discount": 0,
      "couponScope": 2,
      "scopeValues": "1001",
      "number": 99,
      "takingEffectTime": "2026-09-01T00:00:00",
      "expirationTime": "2026-09-30T23:59:59",
      "receiveType": 1,
      "limitNumber": 1,
      "expirationType": 1,
      "expirationDay": null,
      "remark": ""
    }
  ]
}
```

## 2. 查询商品优惠券列表

### `GET /app-api/product/coupon/list`

查询商品优惠券列表，支持分页或不分页。

### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | 1 | 页码，从 1 开始 |
| pageSize | int | 否 | 10 | 每页条数，最大 100 |
| ids | long[] | 否 | - | 按优惠券 ID 集合筛选 |
| couponName | string | 否 | - | 优惠券名称 |
| couponType | int | 否 | - | `1` 满减券，`2` 折扣券 |
| isPage | int | 否 | - | `1` 分页，`2` 不分页 |
| shopId | long | 否 | - | 店铺 ID |

## 3. 按优惠券 ID 领取

### `GET /app-api/product/coupon/relation/receive/{id}`

领取指定的商品优惠券。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| id | long | 是 | 商品优惠券 ID |

### 请求示例

```http
GET /app-api/product/coupon/relation/receive/3001
Authorization: Bearer <token>
```

### 响应示例

```json
{
  "code": 0,
  "msg": "",
  "data": true
}
```

## 4. 按兑换码领取商品优惠券

### `GET /app-api/product/coupon/relation/receive/cdkey/{code}`

根据通用兑换码或一券一码兑换码领取商品优惠券。兑换码必须有效且未使用；一券一码兑换成功后，该兑换码会被标记为已使用。
兑换成功后返回刚领取的用户优惠券基本信息，`detailId` 为用户优惠券关联记录 ID，`id` 为商品优惠券配置 ID。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| code | string | 是 | 优惠券兑换码，放在 URL 路径中；特殊字符需要 URL 编码 |

### 请求示例

```http
GET /app-api/product/coupon/relation/receive/cdkey/WELCOME2026
Authorization: Bearer <token>
```

### 响应示例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "shopName": "示例店铺",
    "detailId": 4001,
    "id": 3001,
    "couponName": "满 10 减 2",
    "couponValue": 2.00,
    "couponType": 1,
    "threshold": 10.00,
    "discount": 0,
    "couponScope": 2,
    "scopeValues": "1001",
    "number": 99,
    "receiveType": 1,
    "limitNumber": 1,
    "expirationType": 1,
    "takingEffectTime": "2026-09-01T00:00:00",
    "expirationTime": "2026-09-30T23:59:59",
    "expirationDay": null,
    "remark": "",
    "receiveTime": "2026-09-01T12:00:00"
  }
}
```

### `data` 字段说明（`UserCouponVO`）

| 字段 | 类型 | 说明 |
|------|------|------|
| shopName | string | 店铺名称 |
| detailId | long | 用户优惠券关联记录 ID；下单或核销时按业务要求使用 |
| id | long | 商品优惠券配置 ID |
| couponName | string | 优惠券名称 |
| couponKind | int | 发放模式：`1` 普通券，`2` 周期券 |
| couponValue | number | 优惠券面值 |
| couponType | int | 优惠券类型：`1` 满减券，`2` 折扣券 |
| threshold | number | 满减门槛 |
| discount | number | 折扣值 |
| couponScope | int | 使用范围：`1` 全部商品，`2` 指定商品，`3` 排除指定商品 |
| scopeValues | string | 商品范围值 |
| number | long | 优惠券剩余数量 |
| receiveType | int | 领取限制：`1` 不限制，`2` 限制次数 |
| limitNumber | long | 每人最多领取数量 |
| expirationType | int | 有效期类型：`1` 按时间，`2` 按天数，`3` 永久 |
| takingEffectTime | datetime | 生效时间 |
| expirationTime | datetime | 过期时间；永久券为空 |
| expirationDay | long | 按天数有效时的有效天数 |
| remark | string | 备注 |
| receiveTime | datetime | 本次领取时间 |

### 常见失败响应

失败时接口返回 `CommonResult` 错误结构，`data` 通常为空：

| 场景 | code | msg |
|------|------|-----|
| 兑换码不存在 | `1008006003` | `无效兑换码` |
| 兑换码已使用 | `1008006003` | `该优惠码已被使用或无效` |
| 当前用户已领取过或达到领取上限 | `1008006000` | `领取优惠券到达上限！` |
| 优惠券库存已领完 | `1008006002` | `无可领优惠券！` |
| 当前不在周期券发放时间内 | `1008006007` | `当前不在优惠券发放时间内` |

例如，优惠券已领完时：

```json
{
  "code": 1008006002,
  "msg": "无可领优惠券！",
  "data": null
}
```

前端可直接展示响应中的 `msg`，不应将这些情况当作成功响应处理。

## 5. 查询我的商品优惠券

### `GET /app-api/product/coupon/relation/searchUserCoupon/{type}`

查询当前登录用户的商品优惠券。

### 路径参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| type | int | 是 | `1` 可使用，`2` 已使用，`3` 已失效 |

响应中的 `detailId` 是用户优惠券关联记录 ID；下单核销时应使用业务要求的优惠券 ID 字段，不要把 `detailId` 与优惠券配置 ID 混用。

### 请求示例

```http
GET /app-api/product/coupon/relation/searchUserCoupon/1
Authorization: Bearer <token>
```

### 响应示例

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "shopName": "示例店铺",
      "couponKind": 1,
      "businessRegionId": 10,
      "shopScopeType": 1,
      "shopScopeValues": "",
      "detailId": 4001,
      "id": 3001,
      "couponName": "满 10 减 2",
      "couponValue": 2.00,
      "couponType": 1,
      "threshold": 10.00,
      "discount": 0,
      "couponScope": 2,
      "scopeValues": "1001",
      "number": 99,
      "receiveType": 1,
      "limitNumber": 1,
      "expirationType": 1,
      "takingEffectTime": "2026-09-01T00:00:00",
      "expirationTime": "2026-09-30T23:59:59",
      "expirationDay": null,
      "remark": "",
      "receiveTime": "2026-09-01T12:00:00"
    }
  ]
}
```

## 前端兑换注意事项

当前后端没有以下接口：

```http
POST /app-api/coupon/receive
```

因此兑换码不能通过 JSON Body `{ "code": "..." }` 调用。应将兑换码拼接到路径中，使用上面的 GET 接口：

```js
const code = encodeURIComponent(redeemCode.trim());
const response = await request({
  url: `/app-api/product/coupon/relation/receive/cdkey/${code}`,
  method: 'GET'
});
```
