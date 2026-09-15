# 活动 H5 Ticket 认证技术设计

## 接口实现

接口挂在现有 `AppAuthController`，路径前缀为 `/app-api/member/auth`。生成接口使用现有 `@PreAuthenticated`，兑换接口使用 `@PermitAll`。

生成接口从 `SecurityFrameworkUtils.getLoginUser()` 取得会员 ID、用户类型和租户 ID，生成不可预测的 UUID ticket，写入 Redis，TTL 为 60 秒。

兑换接口使用 Redis Lua `GET + DEL` 原子操作消费 ticket。消费成功后通过 `TenantUtils.execute(ticket.tenantId, ...)` 恢复租户上下文，调用现有 `OAuth2TokenApi.createAccessToken` 签发 Token。Token 使用现有 `default` OAuth2 client，避免新增客户端数据初始化；后续可按需要注册独立的 H5 client。

## Redis 数据

- Key：`yshop_webview_ticket:{ticket}`
- Value：JSON，包含 `userId`、`userType`、`tenantId`
- TTL：60 秒
- 消费：Lua 脚本原子读取并删除

只保存 backend 内部身份引用，不保存 openid、微信凭证和访问 Token。

## 租户安全

兑换路径加入 `yshop.tenant.ignore-urls`，使匿名请求可以进入 Controller；进入 Service 后立即根据 ticket 的租户 ID 设置上下文，并由现有 OAuth2 Token 服务写入 Token。请求头中的 `tenant-id` 不参与兑换身份判断。

## 失败语义

无效、过期或重复 ticket 统一返回会员认证错误 `1004003007`，避免泄露 ticket 当前是否存在。
