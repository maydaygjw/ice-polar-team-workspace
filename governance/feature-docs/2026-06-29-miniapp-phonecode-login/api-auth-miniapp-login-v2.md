# 接口说明 — auth-miniapp-login-v2（小程序新版手机号登录）

## 概述
微信小程序一键登录（新版手机号方案）。前端用 `getPhoneNumber` 回调拿到的 `code`，后端通过微信 `getNewPhoneNoInfo(code)` 直换手机号完成登录/注册，**不依赖 sessionKey**。

替代旧接口 `auth-miniapp-login`（已 `@Deprecated`，依赖 sessionKey 解密 encryptedData，存在 sessionKey 失效导致登录崩溃的问题）。

## 基本信息

| 项 | 值 |
|----|----|
| Method | `POST` |
| Path | `/app-api/member/auth/auth-miniapp-login-v2` |
| 认证 | 无需登录（匿名可访问） |
| Content-Type | `application/json` |
| 必需 Header | `tenant-id: 153` |

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `phoneCode` | string | 是 | `getPhoneNumber:ok` 回调返回的 `e.detail.code`，一次性、约 5 分钟有效 |
| `openid` | string | 是 | 用户 openid（由 `auth-session` 接口换取），用于绑定 `routine_openid` |

请求示例：
```json
{
  "phoneCode": "e31b2c...（微信回调 code）",
  "openid": "o72WH1xxxxxxxxxxxxxxxxxxxxxxx"
}
```

## 响应

`CommonResult<AppAuthLoginRespVO>`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 0 成功；非 0 失败 |
| `msg` | string | 错误信息 |
| `data.userId` | long | 用户编号 |
| `data.accessToken` | string | 访问令牌 |
| `data.refreshToken` | string | 刷新令牌 |
| `data.expiresTime` | datetime | 令牌过期时间 |
| `data.openId` | string | 用户 openid |
| `data.userInfo` | object | 用户信息（AppUserQueryVo） |
| `data.isActive` | bool | 是否激活（仅 auth-session 返回，本接口不设置） |

成功示例：
```json
{
  "code": 0,
  "msg": "",
  "data": {
    "userId": 1024,
    "accessToken": "xxx",
    "refreshToken": "yyy",
    "expiresTime": "2026-07-28T22:00:00",
    "openId": "o72WH1xxxx",
    "userInfo": { }
  }
}
```

## 错误码

| code | msg | 触发场景 |
|------|-----|----------|
| `1004004002` | 登录失败，请联系管理员 | `getNewPhoneNoInfo(phoneCode)` 失败（code 无效/已用/过期，或微信接口异常） |
| 校验错误 | 手机号code不能为空 / 登录openid不能为空 | 请求体字段缺失 |

## 业务逻辑
1. `getNewPhoneNoInfo(phoneCode)` 换取手机号（失败抛 `MINI_AUTH_LOGIN_BAD`）。
2. 按手机号查用户：不存在则注册（`createUserIfAbsent`，登录类型 ROUNTINE），绑定 openid，生成默认昵称 `微信用户_xxxxxxxx`。
3. 已存在但 `routineOpenid` 为空则补绑。
4. 签发 token（登录日志类型 `LOGIN_SOCIAL`），返回登录态。

## 前端调用要点
1. 先调 `POST /app-api/member/auth/auth-session`（`{ code: wx.login().code }`）换取 `openid`。
2. 用户点击 `<button open-type="getPhoneNumber" bindgetphonenumber="...">`，回调取 `e.detail.code` 作为 `phoneCode`。
3. 调本接口完成登录。

> 注意：`phoneCode` 与 `auth-session` 的 `code` 是**两个不同的 code**（前者来自 getPhoneNumber 回调，后者来自 wx.login）。两者均为一次性。
