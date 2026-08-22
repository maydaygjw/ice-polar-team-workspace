# 企业微信跨租户共享欢迎语回调契约增量

## Callback API

### GET `/app-api/mp/wecom/callback/{corpId}`

- Query：`msg_signature`、`timestamp`、`nonce`、`echostr`。
- 用 CorpID 跨租户定位回调配置，验签并解密 `echostr`。
- 成功返回 `text/plain;charset=UTF-8` 明文 `echostr`。

### POST `/app-api/mp/wecom/callback/{corpId}`

- Query：`msg_signature`、`timestamp`、`nonce`。
- Body：企业微信加密 XML。
- 解密后只处理 `change_external_contact/add_external_contact`。
- State 格式：`v1:t{tenantId}:r{businessRegionId}`。
- 成功返回纯文本 `success`。

## Internal Redis Message

原有 `WecomWelcomeMessageEvent` 语义保持不变；其 `accountId` 改为 State 解析出的目标租户账号 ID，Redis 租户 Header 改为 State 解析出的目标租户 ID。新增可选的 `businessRegionId` 字段，避免消费者再次按旧商圈编码解析。

## Admin API

企业微信账号创建/更新请求增加：

- `appName`：企业微信应用名称；新建必填。
- `agentId`：企业微信 AgentId；可为空。

账号响应、分页响应和精简列表增加 `appName`、`agentId`。明文 Secret、Token、EncodingAESKey 仍不返回。

## Database

迁移脚本：`backend/sql/upgrade-2026-08-21-wecom-shared-callback-routing.sql`。

- `app_name varchar(100) NULL`
- `agent_id int NULL`
- 历史 `app_name` 回填 `name`。
- 现有租户唯一约束不变。

## Compatibility

- 旧 URL `/callback/{accountId}` 不再作为新配置地址；现有环境切换企业微信回调配置时使用 CorpID URL。
- 旧 State 仅能由旧账号上下文推断，无法安全支持共享租户路由；上线后需更新联系我配置。
