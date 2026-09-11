# 企业微信客户管理员与统一内部标签契约变更

## Admin API

管理端统一使用 `/admin-api` 前缀，响应遵循 `{code, data, msg}`。

| Method | Path | Permission | Semantics |
|---|---|---|---|
| GET | `/admin-api/mp/wecom-customer-admin/page` | `mp:wecom-customer-admin:query` | 分页查询当前租户指定企业微信配置的客户管理员，可按内部标签和当前范围筛选 |
| POST | `/admin-api/mp/wecom-customer-admin/sync?accountId={id}` | `mp:wecom-customer-admin:sync` | 从企业微信客户联系权限范围同步客户管理员，返回新增/更新/移出范围统计 |
| GET | `/admin-api/mp/wecom-customer-admin/get?id={id}` | `mp:wecom-customer-admin:query` | 查询客户管理员详情及内部标签 |
| GET | `/admin-api/mp/wecom-customer-admin/simple-list?accountId={id}` | `mp:wecom-customer-admin:query` | 返回成员选择器选项，包含客户管理员 ID、userid、展示名称和当前范围状态 |
| GET | `/admin-api/mp/wecom-customer-contact/page` | `mp:wecom-customer-contact:query` | 分页查询客户联系人；可选 `tagIds: String[]` 按企业微信客户标签筛选，多个标签为 OR 关系 |
| GET | `/admin-api/mp/wecom-internal-tag/list` | `mp:wecom-internal-tag:query` | 查询当前租户内部标签，不接收 accountId 作为隔离条件 |
| POST | `/admin-api/mp/wecom-internal-tag/create` | `mp:wecom-internal-tag:create` | 创建当前租户内部标签 |
| PUT | `/admin-api/mp/wecom-internal-tag/update` | `mp:wecom-internal-tag:update` | 修改当前租户内部标签名称或排序 |
| DELETE | `/admin-api/mp/wecom-internal-tag/delete?id={id}` | `mp:wecom-internal-tag:delete` | 删除内部标签并解除全部关联 |
| POST | `/admin-api/mp/wecom-internal-tag/batch-bind` | `mp:wecom-internal-tag:assign` | 将一个或多个内部标签绑定到客户群或客户管理员 |
| POST | `/admin-api/mp/wecom-internal-tag/batch-unbind` | `mp:wecom-internal-tag:assign` | 解除客户群或客户管理员的内部标签绑定 |

### DTO 约定

- 客户管理员查询：`accountId: Long`、`pageNo`、`pageSize`、可选 `tagIds: Long[]`、可选 `inScope: boolean`。
- 客户管理员响应：`id: Long`、`accountId: Long`、`userid: String`、`inScope: boolean`、`lastSyncTime`、`tags: InternalTagSimple[]`。
- 客户管理员 simple-list 响应：`id: Long`、`userid: String`、`displayName: String`、`inScope: boolean`；displayName 无可靠来源时回退 userid。
- 同步响应：`accountId`、`total`、`created`、`updated`、`outOfScope`、`failed`、安全错误摘要列表。
- 内部标签：`id: Long`、`name: String`、`sort: Integer`、`groupCount`、`customerAdminCount`。
- 批量绑定：`targetType: CUSTOMER_GROUP|CUSTOMER_ADMIN`、`targetIds: Long[]`、`tagIds: Long[]`、`accountId`；服务端验证目标和标签租户归属。
- 客户群分页、群发和定时推送中的标签字段改为内部标签 ID；原接口路径保持不变，旧标签 ID 不再接受。
- 联系我创建/编辑的 `userIds` 仍为 `String[]`，但管理端必须通过客户管理员 simple-list 选择生成，不再提供成员 UserID 自由文本输入。
- 客户群群发/定时推送的 `sender` 仍为单个 `String` userid；管理端必须通过客户管理员 simple-list 选择。
- 客户联系人发送的 `followUserId` 仍为单个 `String` userid；管理端保持下拉，并使用客户管理员数据补充展示名称。

## Compatibility

- 客户标签 API `/mp/wecom-customer-tag/*` 保持路径、权限和企业微信实时语义不变，仅调整菜单父级为“标签管理 → 客户标签”。
- 客户联系人分页和详情中的 `tags` 仍表示企业微信客户标签；不得混入内部标签。分页接口支持按 `tagIds` 筛选，标签 ID 使用企业微信返回的字符串 ID，多个标签为 OR 关系。
- 客户群页面的标签 API 改为内部标签来源；群发任务历史记录中的 `tag_ids` 需要按新内部标签 ID 解释，迁移必须先完成。
- 旧客户群标签 Controller/Service 在迁移发布后不再被前端调用；兼容期可保留只读代码，禁止继续写旧表。

## Database

- 新增 `mp_wecom_customer_admin`、`mp_wecom_internal_tag`、`mp_wecom_internal_tag_rel`。
- 新增迁移脚本：`backend/sql/upgrade-2026-09-11-wecom-customer-admin-internal-tags.sql`。
- 脚本创建新表、按租户和名称迁移客户群标签、迁移群-标签关联、建立菜单和权限，并提供迁移统计校验。
- 脚本同时转换 `mp_wecom_customer_group_schedule.tag_ids` 中的旧客户群标签 ID；转换前后必须校验每个启用中的定时推送仍有有效内部标签。
- 旧客户群标签表暂不删除；回滚通过恢复旧查询/写入逻辑并保留新表数据完成。禁止在未备份和未确认的情况下 DROP 旧表。
- 所有新表包含 `tenant_id`、审计字段和软删除字段；查询显式带租户范围，关联操作验证对象租户。

## Permissions and data scope

- 新增权限：`mp:wecom-customer-admin:query`、`mp:wecom-customer-admin:sync`、`mp:wecom-customer-admin:assign`、`mp:wecom-internal-tag:query`、`mp:wecom-internal-tag:create`、`mp:wecom-internal-tag:update`、`mp:wecom-internal-tag:delete`、`mp:wecom-internal-tag:assign`。
- 客户管理员同步必须验证 `accountId` 属于当前租户；内部标签接口不信任前端传入 tenantId。
- 客户群和客户管理员关联接口必须同时校验目标、标签和企业微信配置的租户归属。
- 所有接收 userid 的业务接口必须在服务端校验 userid 属于对应企业微信配置的客户联系权限范围；不能仅信任前端下拉值。

## External system

- 使用现有企业微信客户联系 API：`GET /cgi-bin/externalcontact/get_follow_user_list`。
- 使用现有 CorpID + 客户联系 Secret 获取 access token；不新增通讯录同步 Secret。
- 非零 `errcode`、超时、返回字段缺失均转换为业务失败；同步失败不改变已存在的成员范围状态。
- 外部请求和响应仅允许 DEBUG 脱敏记录；不得记录 Secret、access_token 或完整敏感响应。

## Error semantics

- 账号不存在、跨租户 accountId、跨租户标签或目标对象：业务错误，禁止访问外部接口。
- 内部标签名称为空、超长、租户内重复：参数或业务错误。
- 目标类型与目标 ID 不匹配、目标不存在、重复关联：返回可理解的业务错误或幂等成功，具体由实现测试冻结。
- 联系我提交的 userid 不在当前客户联系权限范围时返回明确业务错误；部门 ID 仍按联系我原有规则单独校验。
- 迁移失败必须阻止新查询切换，并输出迁移统计/失败原因；不得部分迁移后报告成功。

## External references

- 企业微信：[获取配置了客户联系功能的成员列表](https://developer.work.weixin.qq.com/document/path/92571)
- 企业微信：[获取成员ID列表](https://developer.work.weixin.qq.com/document/path/96067)不在本期使用范围内。
