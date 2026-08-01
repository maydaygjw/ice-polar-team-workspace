# 契约变更

## API

管理端统一使用 `/admin-api` 前缀，响应遵循 `{code, data, msg}`。

### 客户联系人同步

| Method | Path | Permission | Semantics |
|---|---|---|---|
| POST | `/admin-api/mp/wecom-customer-contact/sync?accountId={id}` | `mp:wecom-customer-contact:sync` | 拉取指定企业微信配置可见的客户联系人并 upsert，返回同步汇总 |
| GET | `/admin-api/mp/wecom-customer-contact/page` | `mp:wecom-customer-contact:query` | 按配置、名称、外部联系人 ID、UnionID 和匹配状态分页查询 |
| GET | `/admin-api/mp/wecom-customer-contact/get?id={id}` | `mp:wecom-customer-contact:query` | 获取联系人详情、跟进员工和会员匹配结果 |
| POST | `/admin-api/mp/wecom-customer-contact/send-message` | `mp:wecom-customer-contact:send` | 为指定联系人创建一条企业微信客户群发文本任务 |

分页请求字段：`pageNo`、`pageSize`、`accountId`、`name`、`externalUserId`、`unionId`、`matchStatus`。

分页响应字段：`id`、`accountId`、`externalUserId`、`name`、`avatar`、`type`、`gender`、`unionIdMasked`、`matchStatus`、`memberId`、`memberNickname`、`memberMobileMasked`、`followUserCount`、`lastSyncTime`。

详情响应在分页字段基础上增加 `followUsers`，每项包括 `userId`、`remark`、`description`、`addWay`、`createTime`；不返回 Secret、access token 或完整手机号。

同步响应字段：`accountId`、`total`、`created`、`updated`、`matched`、`unmatched`、`failed`、`failedMessages`。

发送消息请求体：`contactId`、`followUserId`、`content`。其中 `followUserId` 必须是该联系人当前同步到的跟进成员之一，`content` 为文本消息，长度不超过 2000 个字符。

发送消息响应字段：`msgId`。接口成功表示企业微信已创建群发任务，不表示客户已经收到；跟进成员仍需在企业微信客户端确认发送。

### 状态与错误语义

- `matchStatus`：`MATCHED`（唯一匹配）、`UNMATCHED`（UnionID 为空或无会员匹配）、`AMBIGUOUS`（当前租户存在多个相同 UnionID 会员）。
- 配置不存在、租户不匹配、并发同步、凭证无效、外部接口无权限或外部接口超时返回业务错误。
- 列表或详情阶段的局部失败不回滚已成功写入的数据；失败联系人计入 `failed`，并返回不含凭证的错误摘要。
- `externalUserId` 是企业微信配置范围内的外部联系人标识；不能跨配置作为全局唯一键。
- 现有企业微信配置 API、客户群 API 保持兼容，不修改既有 DTO 字段语义。

## DB

### `mp_wecom_customer_contact`

- `id` bigint 主键；`tenant_id`、`account_id`、`external_userid` 必填。
- 保存 `union_id`（可空）、`name`、`avatar`、`type`、`gender`、`corp_name`、`corp_full_name`、`member_id`（可空）、`match_status`、`last_sync_time`。
- 保存企业微信返回的扩展属性快照 JSON，原始字段不作为管理端契约直接透传。
- 标准 `creator/create_time/updater/update_time/deleted` 字段。
- 唯一索引 `(tenant_id, account_id, external_userid, deleted)`；查询索引 `(tenant_id, account_id, name)`、`(tenant_id, account_id, union_id)`、`(tenant_id, account_id, match_status)`。

### `mp_wecom_customer_contact_follow`

- `id` bigint 主键；`tenant_id`、`contact_id`、`follow_userid` 必填。
- 保存跟进员工 ID、备注、描述、添加来源和首次跟进时间。
- 标准 `creator/create_time/updater/update_time/deleted` 字段。
- 唯一索引 `(tenant_id, contact_id, follow_userid, deleted)`，避免重复同步产生重复关系。

### Migration / Rollback

- 新增脚本：`backend/sql/upgrade-2026-07-31-wecom-customer-contact-sync.sql`。
- 脚本创建两张新表和客户联系人查询权限；不得修改 `sql/yixiang-drink.sql`。
- 回滚删除本功能菜单、权限和两张新表；执行回滚前必须确认没有依赖联系人匹配结果的后续业务。
- 不修改 `yshop_user` 结构，不回写会员 UnionID，不删除既有客户群数据。

## 权限与数据范围

- 同步、查询和发送分别使用 `mp:wecom-customer-contact:sync`、`mp:wecom-customer-contact:query`、`mp:wecom-customer-contact:send`。
- 所有联系人、跟进关系和会员匹配查询自动带当前租户条件；配置 ID、联系人 ID 和会员 ID 均需再次校验租户归属。
- 本期沿用客户群同步的数据范围：租户管理员在当前租户内可见全部企业微信联系人，不增加部门或门店数据权限。

## 外部系统

- 认证继续使用现有企业微信配置的 CorpID 和客户联系 Secret 获取 access token；凭证只在服务端使用。
- 获取配置了客户联系功能的员工列表：`GET /cgi-bin/externalcontact/get_follow_user_list`。
- 获取员工客户列表：`GET /cgi-bin/externalcontact/list?userid={userid}`，读取 `external_userid`，按接口分页/上限处理。
- 获取联系人详情：`GET /cgi-bin/externalcontact/get?external_userid={external_userid}`，读取联系人基本资料、`unionid` 和可见的 `follow_user` 关系。
- 创建客户群发文本任务：`POST /cgi-bin/externalcontact/add_msg_template`，使用联系人 `external_userid` 和已同步的跟进成员 `userid`，不使用 `unionid` 作为发送目标。
- 获取 UnionID 需要企业微信侧绑定与小程序同主体的微信开发者账号，并具备客户基础信息权限；UnionID 缺失时仍保存联系人。
- 同步过程使用单次请求超时、分页读取和同配置 Redisson 锁；access token 不写入业务表，不进入管理端响应。
- 列表阶段失败终止本次同步；单个联系人详情失败继续处理其他联系人，并保留该联系人历史数据。
- 发送消息只允许选择当前联系人已同步的跟进成员；企业微信返回的 `fail_list` 视为本次发送失败，不记录 Secret、access token 或原始响应。
