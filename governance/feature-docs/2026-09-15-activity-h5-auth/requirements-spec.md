# 活动 H5 Ticket 认证需求

## 目标

让已在小程序或其他可信客户端登录的会员安全打开内部活动 H5，并在 H5 中调用 backend 的业务接口。

## 范围

- 新增生成一次性 webview ticket 的 app-api。
- 新增兑换 ticket 为 backend OAuth2 Token 的 app-api。
- ticket 与用户、租户绑定，不能承载 openid、微信 access_token 或 backend 长期 Token。
- 不改造微信登录流程，不新增数据库表，不实现 H5 页面业务接口。

## 业务规则

1. 生成 ticket 必须携带当前会员的有效 Bearer Token。
2. ticket 只保存 60 秒，且只能成功兑换一次。
3. 兑换接口匿名可访问，但只能接受 Redis 中存在且未消费的 ticket。
4. 兑换时使用 ticket 保存的租户上下文签发 backend Token，不能信任请求方传入的租户或用户信息。
5. H5 后续请求通过 `Authorization: Bearer <accessToken>` 调用 backend。
6. ticket 不记录在普通访问日志中，接口响应不返回 openid。

## 验收标准

- 未登录调用生成接口返回未认证错误。
- 有效登录用户生成 ticket，响应包含 ticket 和有效期秒数。
- 有效 ticket 兑换返回 `accessToken`、`refreshToken`、`expiresTime` 和 `userId`。
- 过期、伪造、已兑换 ticket 均不能获得 Token。
- 并发兑换同一 ticket 最多一个请求成功。
- ticket 不能跨租户使用，兑换后的 Token 只能访问 ticket 所属租户数据。
