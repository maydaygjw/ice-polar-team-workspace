# 企业微信客户标签库管理契约变更

## API

管理端统一使用 `/admin-api` 前缀，响应遵循 `{code, data, msg}`。

| Method | Path | Permission | Semantics |
|---|---|---|---|
| GET | `/admin-api/mp/wecom-customer-tag/list?accountId={id}` | `mp:wecom-customer-tag:query` | 实时获取指定企业微信配置的有效标签组及标签 |
| POST | `/admin-api/mp/wecom-customer-tag/create` | `mp:wecom-customer-tag:create` | 创建新标签组及首批标签，或向已有组新增标签 |
| PUT | `/admin-api/mp/wecom-customer-tag/update` | `mp:wecom-customer-tag:update` | 修改一个标签组或标签的名称/排序 |
| DELETE | `/admin-api/mp/wecom-customer-tag/delete?accountId={accountId}&id={id}&type={GROUP\|TAG}` | `mp:wecom-customer-tag:delete` | 删除一个标签组或标签 |

### DTO

- `list` 请求：`accountId: Long`。
- `list` 响应：`WecomCustomerTagGroupRespVO[]`，字段为 `groupId`、`groupName`、`createTime`、`order`、`tags`；`tags` 每项字段为 `id`、`name`、`createTime`、`order`。
- `create` 请求：`accountId: Long`、可选 `groupId: String`、可选 `groupName: String`、可选 `groupOrder: Long`、`tags: [{name: String, order: Long}]`。新组必须有 `groupName` 和至少一个标签；已有组必须有 `groupId` 和至少一个标签，`groupName/groupOrder` 被忽略。
- `update` 请求：`accountId: Long`、`id: String`、`type: GROUP|TAG`、可选 `name: String`、可选 `order: Long`；至少提供 `name` 或 `order`。
- `delete` 请求：`accountId: Long`、`id: String`、`type: GROUP|TAG`；`type=GROUP` 调用 `group_id`，`type=TAG` 调用 `tag_id`。

### 错误语义

- 账号不存在或不属于当前租户：业务错误，禁止调用企业微信。
- 参数校验失败：名称为空/超过 30 个字符、标签组为空、排序值越界或对象类型非法。
- 企业微信返回非零 `errcode`、超时、无权限或对象不存在：业务失败，保留企业微信错误码和安全错误摘要，不返回 token、Secret 或原始响应。
- 成功写操作返回 `true` 或创建接口返回企业微信新建标签组的管理端 DTO；前端随后重新读取实时列表。

## DB

不新增业务表、字段或索引；企业微信是本期标签数据的唯一来源。新增一份幂等的菜单/权限迁移脚本，用于注册管理页面和租户管理员权限。

## 权限与数据范围

- 新增权限：`mp:wecom-customer-tag:query`、`mp:wecom-customer-tag:create`、`mp:wecom-customer-tag:update`、`mp:wecom-customer-tag:delete`。
- `accountId` 必须由后端按当前租户验证；不得信任前端传入的跨租户配置编号。
- 本期不增加部门、商圈或门店数据范围，沿用企业微信配置的租户管理员边界。

## 外部系统

- API 版本：企业微信服务端客户联系 API，文档最后更新 2023-12-01。
- `POST /cgi-bin/externalcontact/get_corp_tag_list`：`group_id/tag_id` 为空时获取当前有效标签库。
- `POST /cgi-bin/externalcontact/add_corp_tag`：新组通过 `group_name` 创建，已有组通过 `group_id` 添加标签；不支持空标签组。
- `POST /cgi-bin/externalcontact/edit_corp_tag`：通过对象 ID 修改名称或排序。
- `POST /cgi-bin/externalcontact/del_corp_tag`：通过 `tag_id` 或 `group_id` 删除对象，二者不能同时为空。
- 认证使用现有企业微信配置的 CorpID + 客户联系 Secret 获取 access token；token 只在服务端请求内存中使用。

## Machine Snapshot

governance/CONTRACT/backend-api.json 未在本次本地验证中重新生成；该流程需要完整启动后端及其运行时依赖。实现契约以本文件和后端 Swagger 注解为准，部署环境可用后按治理流程生成并收集 OpenAPI 快照。
