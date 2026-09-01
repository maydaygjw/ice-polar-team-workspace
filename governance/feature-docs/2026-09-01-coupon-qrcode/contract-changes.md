# 契约变更

## Admin API

新增 `GET /admin-api/product/coupon/qrcode/{id}`，权限 `product:coupon:qrcode`。

请求：路径参数 `id: Long` 为优惠券 ID；可选查询参数 `cdkey: String` 为具体兑换码；租户由认证上下文确定。

参数规则：

| `getType` | 类型 | 参数 | 生成内容 |
|---|---|---|---|
| `0` | 无码/页面领取 | 不传 `cdkey` | `{coupon_mini_app_page}?couponId={couponId}` |
| `1` | 通用码 | 可不传；不传时服务端读取该券已配置的通用码 | `{coupon_mini_app_page}?cdkey={cdkey}` |
| `2` | 一卡一码 | 必传具体 `cdkey`，且必须属于该券并处于未兑换状态 | `{coupon_mini_app_page}?cdkey={cdkey}` |

响应：

```json
{
  "code": 0,
  "data": {
    "url": "{coupon_mini_app_page}?couponId=123",
    "qrcodeUrl": "https://host/admin-api/..."
  },
  "msg": "success"
}
```

`qrcodeUrl` 为服务端保存的真实微信小程序码文件地址，`url` 为可复制的相对页面链接。
`url` 的查询参数必须与微信小程序码的 `scene` 参数一致；兑换码券不得返回仅携带 `couponId` 的链接。

通用码响应示例：

```json
{
  "code": 0,
  "data": {
    "url": "{coupon_mini_app_page}?cdkey=WELCOME2026",
    "qrcodeUrl": "https://host/admin-api/..."
  },
  "msg": "success"
}
```

## Authorization and tenant isolation

- 需要 `product:coupon:qrcode` 权限。
- 查询优惠券使用现有 MyBatis Plus 租户过滤；不得通过请求参数切换租户。
- 主小程序使用当前租户的 `isMiniApp=1` 且 `isMain=1` 账号。
- 页面路径使用当前租户参数 `coupon_mini_app_page`；参数为空时返回“请先配置优惠券小程序页面路径”。
- `getType=0` 只允许使用 `couponId` 场景；`getType=1/2` 必须使用 `cdkey` 场景。
- `getType=1` 的 `cdkey` 必须解析到当前优惠券的通用码；`getType=2` 的 `cdkey` 必须解析到当前优惠券的未兑换兑换码。
- 不传 `cdkey` 生成 `getType=2` 二维码，或兑换码不存在、已删除、已兑换、归属其他优惠券时，返回兑换码无效错误。

## Database / events / dependencies

N/A: 不新增或修改表，不新增 MQ 事件；复用现有微信小程序 SDK、兑换码查询、租户参数和二维码文件服务。
