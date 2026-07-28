# 契约变更

## API

管理端统一使用 `/admin-api` 前缀，响应遵循 `{code, data, msg}`。

### 企业微信配置

| Method | Path | Permission | Semantics |
|---|---|---|---|
| POST | `/admin-api/mp/wecom-account/create` | `mp:wecom-account:create` | 创建配置；`name`、`corpId`、`secret` 必填 |
| PUT | `/admin-api/mp/wecom-account/update` | `mp:wecom-account:update` | 更新配置；`secret` 为空时保留原值 |
| DELETE | `/admin-api/mp/wecom-account/delete?id={id}` | `mp:wecom-account:delete` | 删除当前租户配置 |
| GET | `/admin-api/mp/wecom-account/get?id={id}` | `mp:wecom-account:query` | 获取配置；不返回明文 Secret |
| GET | `/admin-api/mp/wecom-account/page` | `mp:wecom-account:query` | 分页查询配置 |
| GET | `/admin-api/mp/wecom-account/list-all-simple` | `mp:wecom-account:query` | 获取客户群筛选使用的配置编号/名称列表 |

请求字段：`id`、`name`、`corpId`、`secret`、`remark`。响应字段：`id`、`name`、`corpId`、`secretMasked`、`remark`、`lastSyncTime`、`createTime`。

### 客户群

| Method | Path | Permission | Semantics |
|---|---|---|---|
| POST | `/admin-api/mp/wecom-customer-group/sync?accountId={id}` | `mp:wecom-customer-group:sync` | 拉取并 upsert 指定配置的全部客户群，返回 `total/success/failed` |
| GET | `/admin-api/mp/wecom-customer-group/page` | `mp:wecom-customer-group:query` | 按 `accountId`、`chatId`、`name` 分页查询本地快照 |

同步响应：`accountId`、`total`、`success`、`failed`、`failedMessages`。失败消息只返回企业微信错误摘要，不返回 Secret 或 access token。

错误语义：配置不存在、租户不匹配、并发同步、凭证无效、外部接口无权限、外部接口超时均返回业务错误；局部详情失败不回滚已成功写入的数据，并通过同步汇总返回失败数量。

## DB

### `mp_wecom_account`

- `id` bigint 主键。
- `tenant_id` bigint 非空，自动租户隔离。
- `name` varchar(100)；`corp_id` varchar(100)；`secret` varchar(512)，使用现有加密 TypeHandler；`remark` varchar(255)。
- `last_sync_time` datetime，可空。
- 标准 `creator/create_time/updater/update_time/deleted` 字段。
- 唯一索引 `(tenant_id, corp_id, deleted)`。

### `mp_wecom_customer_group`

- `id` bigint 主键；`tenant_id`、`account_id`、`chat_id` 为必填。
- `name`、`owner`、`notice`、`remark`、`status`、`member_count`、`external_create_time`、`member_list`、`last_sync_time`。
- `member_list` 保存企业微信返回的成员快照 JSON，不作为本期独立查询条件。
- 唯一索引 `(tenant_id, account_id, chat_id, deleted)`，查询索引 `(tenant_id, account_id, name)`。
- 配置删除不级联物理删除客户群；逻辑删除配置后其客户群仍由租户隔离保护，后续清理另行处理。

## 权限与数据范围

- 所有管理端接口使用 `@PreAuthorize` 对应权限。
- 企业微信配置和客户群仅允许当前租户访问；同步先校验 `accountId` 属于当前租户。
- 本期无部门/门店数据权限要求，租户管理员在租户内可见全部企业微信数据。

## 外部系统

- 系统：企业微信客户联系 API。
- 认证：`GET https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid={CorpID}&corpsecret={Secret}`；只在服务端调用，access token 不进入响应或数据库。
- 群列表：`POST https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list`，使用 cursor/limit 分页，单页上限按企业微信接口约束。
- 群详情：`POST https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/get`，按 `chat_id` 获取群基本信息与成员列表。
- 权限：企业“客户联系”Secret，或已配置为可调用客户联系接口的自建应用 Secret。
- 失败策略：HTTP 超时、非零 `errcode`、非法 JSON 均转为可识别业务失败；列表阶段失败终止本次同步，详情阶段按群计数失败并继续。
- 幂等：本地以 `chat_id` upsert；外部 access token 只用于当前同步调用，不缓存为业务数据。
