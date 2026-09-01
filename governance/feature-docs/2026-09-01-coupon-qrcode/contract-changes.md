# 契约变更

## Admin API

新增 `GET /admin-api/product/coupon/qrcode/{id}`，权限 `product:coupon:qrcode`。

请求：路径参数 `id: Long`，优惠券 ID；租户由认证上下文确定。

响应：

```json
{
  "code": 0,
  "data": {
    "url": "/home/index/index?couponId=123",
    "qrcodeUrl": "https://host/admin-api/..."
  },
  "msg": "success"
}
```

`qrcodeUrl` 为服务端保存的真实微信小程序码文件地址，`url` 为可复制的相对页面链接。

## Authorization and tenant isolation

- 需要 `product:coupon:qrcode` 权限。
- 查询优惠券使用现有 MyBatis Plus 租户过滤；不得通过请求参数切换租户。
- 主小程序使用当前租户的 `isMiniApp=1` 且 `isMain=1` 账号。

## Database / events / dependencies

N/A: 不新增或修改表，不新增 MQ 事件；复用现有微信小程序 SDK 和二维码文件服务。
