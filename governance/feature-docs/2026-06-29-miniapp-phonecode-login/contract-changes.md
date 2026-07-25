# Contract Changes — miniapp-phonecode-login

## 背景
旧版手机号登录依赖 sessionKey 解密 `encryptedData`。sessionKey 在 Redis 中被设为 `FOREVER` 永不过期，且 openid 跨登出复用，导致 sessionKey 与 encryptedData 错配，解密产出乱码 → `JsonSyntaxException: Expected BEGIN_OBJECT but was STRING`。用户删小程序重开才恢复。

## 方案：双接口并存，平滑迁移
新增基于微信新版手机号接口的 v2 端点；旧端点保留并标 `@Deprecated`，给存量未更新的小程序兜底。后端可独立先行上线，不依赖小程序同步发布。

## 接口

### 新增 `POST /app-api/member/auth/auth-miniapp-login-v2`
- 请求体：`{ phoneCode, openid }`
- 后端：`getNewPhoneNoInfo(phoneCode)` 直换手机号，不依赖 sessionKey
- `phoneCode`：`getPhoneNumber:ok` 回调的 `e.detail.code`，一次性、约 5 分钟有效
- VO：`AppWxMiniLoginV2VO`；Service：`weixinMiniAppLoginV2(phoneCode, openid)`

### 旧 `POST /app-api/member/auth/auth-miniapp-login`（@Deprecated）
- 请求体不变：`{ encryptedData, iv, openid }`
- 逻辑不变：`getPhoneNoInfo(sessionKey, encryptedData, iv)`
- 保留 `auth-session` 中 `miniRedisDAO.set(sessionKey, openid)`（旧路径仍依赖）
- 标记废弃：Controller `@Operation(deprecated=true)` + `@Deprecated`，VO/Service 同步

## 迁移与下线
1. 后端先上线（双接口），无需等小程序。
2. 小程序三页（scan/map/profile）改用 v2 端点，发版。
3. 待存量旧版小程序流量归零后，再删除旧端点、旧 VO、`weixinMiniAppLogin3`、`MiniRedisDAO` 及 `MINI_AUTH_LOGIN_BAD2`。

## 影响面
- 无 DB 变更、无 UI 变更。
- 后端 `yshop-module-member-biz` 编译通过（JDK 17）。
- 小程序改动页：`pages/scan`、`pages/map`、`pages/profile`（传 phoneCode + 指向 v2 端点）。

## 兼容性
新旧接口独立并存，互不影响。新旧版本小程序均可正常登录。
