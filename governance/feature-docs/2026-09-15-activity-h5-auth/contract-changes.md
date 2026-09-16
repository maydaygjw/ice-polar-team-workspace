# 活动 H5 Ticket 认证契约

统一响应为现有 `CommonResult`。

## 生成 Ticket

`POST /app-api/member/auth/webview-ticket`

- 认证：需要当前会员 Bearer Token。
- 请求体：无。
- 成功响应：

```json
{
  "ticket": "c5f2...",
  "expiresIn": 60
}
```

ticket 仅用于紧接着打开 H5 后兑换，不可替代 backend Token。

## 兑换 Token

`POST /app-api/member/auth/webview-exchange`

- 认证：匿名；身份完全来自一次性 ticket。
- 请求体：

```json
{"ticket":"c5f2..."}
```

- 成功响应：

```json
{
  "userId": 1024,
  "accessToken": "...",
  "refreshToken": "...",
  "expiresTime": "2026-09-15T12:00:00"
}
```

- 无效或重复 ticket：错误码 `1004003007`。

H5 后续业务请求使用返回的 `accessToken` 放在 `Authorization: Bearer` 请求头中；不把 openid、微信 access_token 或 ticket 继续传给业务接口。

## 测试环境 Mock Ticket

仅当 `yshop.security.mock-enable=true` 且
`yshop.security.mock-webview-ticket-enable=true` 时启用。Ticket 格式为配置的
`yshop.security.mock-secret`（测试环境默认是 `test`）加数字用户 ID，例如：

```text
test590471
```

后端使用 `yshop.security.mock-webview-ticket-tenant-id` 恢复配置的测试租户，然后复用会员存在性、启用状态校验和现有 OAuth2 Token 签发流程。该 Mock Ticket 不过期、不消费 Redis，**仅限测试环境**；生产环境必须关闭上述开关。
