# 企业微信跨租户共享欢迎语回调需求规格

## Scope

- 允许同一个企业微信应用为多个租户发送欢迎语。
- 回调 URL 使用 `corpId` 定位企业微信应用配置，不再要求外部 URL 暴露租户上下文。
- 使用企业微信联系我配置的 `State` 路由到租户和商圈。
- 在 `mp_wecom_account` 增加企业微信应用 `agentId` 和应用名称字段，提升后台可读性。
- 影响仓库：`backend`、`admin`。
- `miniapp`、`icepolar-dms`：N/A，不参与本功能。

## Use Cases

1. 租户 A 和租户 B 使用同一个企业微信应用，但分别维护自己的商圈欢迎语模板。
2. 客户通过租户 A 的联系我二维码添加成员，企业微信回调携带租户 A 的 State，系统只发送租户 A 的欢迎语。
3. 管理员在企业微信配置列表中能看到应用名称和 AgentId，区分同一企业下的应用配置。

## Business Rules

- 同一个客户添加事件的 `WelcomeCode` 只能由一个企业微信应用发送；本功能指定共享应用作为唯一发送方。
- `State` 格式固定为 `v1:t{tenantId}:r{businessRegionId}`。不携带 `contactWayId`，因为同一租户同一商圈的联系我配置共用一套欢迎语。
- 回调请求先根据 `corpId` 找到一条可用于验签/解密的账号配置；解密后根据 State 解析目标租户和商圈。
- 目标租户下必须存在同一 `corpId` 的企业微信配置，且该配置的客户联系凭据与共享应用一致；发送记录和模板继续按目标租户隔离。
- `agentId` 是企业微信应用标识信息，仅用于配置识别和展示；本期不改变企业微信 API 调用参数。
- 现有 `mp_wecom_account.name` 保留为系统配置名称；新增 `app_name` 表示企业微信应用名称，避免语义混淆。
- 现有旧格式 State 无法在同一 CorpID 的多个租户间安全路由；上线后新建或更新联系我配置必须使用新格式。旧二维码需要重新生成或更新。

## Frontend Requirements

- 企业微信配置表单新增“应用名称”和“AgentId”。
- 企业微信配置列表展示应用名称、AgentId、CorpID 和配置名称。
- 更新时 Secret、回调 Token、EncodingAESKey 仍保持现有留空保留原值规则。
- AgentId 允许为空以兼容历史配置；应用名称新建时必填，存量数据由迁移脚本从配置名称回填。

## Edge Cases

- `corpId` 不存在或没有完整回调凭据：拒绝回调。
- State 格式非法、租户不存在、商圈不属于目标租户或目标租户没有该 CorpID 配置：拒绝回调，避免错误发送。
- 非客户添加事件：验签解密后忽略并返回成功。
- 同一个 CorpID 下存在凭据不一致的账号记录：不应静默选择错误配置；实现需记录并拒绝发送。
- WelcomeCode 重复投递：沿用现有幂等记录和分布式锁，禁止重复调用外部发送接口。

## Acceptance Criteria

- GET/POST 回调路径为 `/app-api/mp/wecom/callback/{corpId}`，网关前缀外的 Controller 路径为 `/mp/wecom/callback/{corpId}`。
- 租户 A、B 使用同一 CorpID 时，使用不同 State 可以分别命中各自启用模板。
- 目标租户的模板不存在或停用时只跳过，不会发送其他租户模板。
- 同一 WelcomeCode 重复投递不会产生第二次企业微信发送调用。
- 管理端可以录入、编辑并展示 `appName`、`agentId`。
- 存量账号迁移后应用名称有可读值，回调凭据和 Secret 不被清空。
