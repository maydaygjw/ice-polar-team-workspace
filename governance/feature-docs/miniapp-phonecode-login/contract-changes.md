# Contract Changes — miniapp-phonecode-login

## 背景
旧版手机号登录依赖 sessionKey 解密 `encryptedData`。sessionKey 在 Redis 中被设为 `FOREVER` 永不过期，且 openid 跨登出复用，导致 sessionKey 与 encryptedData 错配，解密产出乱码 → `JsonSyntaxException: Expected BEGIN_OBJECT but was STRING`。用户删小程序重开才恢复。

## 方案
改用微信新版手机号接口：`getPhoneNumber` 回调直接拿 `code`，后端 `getNewPhoneNoInfo(code)` 换手机号，彻底不依赖 sessionKey。

## 接口变更（feature-level，非平台级）

`POST /app-api/member/auth/auth-miniapp-login`

| 项 | 旧 | 新 |
|----|----|----|
| 请求体 | `{ encryptedData, iv, openid }` | `{ phoneCode, openid }` |
| 后端解密 | `getPhoneNoInfo(sessionKey, encryptedData, iv)` | `getNewPhoneNoInfo(phoneCode)` |

- `phoneCode`：小程序 `getPhoneNumber:ok` 回调的 `e.detail.code`，一次性、约 5 分钟有效。
- `openid`：保留，用于绑定 `routine_openid`。

## 关联清理
- `auth-session`（`weixinMiniAppLogin2`）删除 `miniRedisDAO.set(sessionKey, openid)` 死代码，根除 Redis 永不过期垃圾 key。
- `MemberAuthServiceImpl` 移除 `MiniRedisDAO` 注入与 import。
- `ErrorCodeConstants.MINI_AUTH_LOGIN_BAD2` 不再被引用（保留定义，无害）。

## 影响面
- 无 DB 变更、无 UI 变更。
- 后端 `yshop-module-member-biz` 编译通过（JDK 17）。
- 小程序改动页：`pages/scan`、`pages/map`、`pages/profile`。

## 兼容性
请求体字段不兼容旧版。**后端与小程序需同时发布**，否则旧小程序传 encryptedData 会触发 `phoneCode 不能为空` 校验失败。
