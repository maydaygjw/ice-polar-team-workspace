# 企业微信素材管理契约变更

## Admin API

管理端统一使用 `/admin-api` 前缀；后端 Controller 的模块路径为 `/mp/...`。

### 素材组

- `GET /admin-api/mp/wecom-material-group/page?accountId={id}&name={name}&pageNo={pageNo}&pageSize={pageSize}`
- `GET /admin-api/mp/wecom-material-group/list?accountId={id}`：返回当前企业微信配置下可用于群发的素材组简表。
- `GET /admin-api/mp/wecom-material-group/get?id={id}`
- `POST /admin-api/mp/wecom-material-group/create`
- `PUT /admin-api/mp/wecom-material-group/update`
- `DELETE /admin-api/mp/wecom-material-group/delete?id={id}`

创建请求必须同时提交首个素材；首个素材字段与素材创建请求相同：

```json
{
  "accountId": 1,
  "name": "周末活动",
  "initialMaterial": {
    "type": "TEXT",
    "textContent": "周末活动开始啦"
  }
}
```

更新请求：

```json
{
  "id": 10,
  "name": "周末活动-新客"
}
```

素材组响应至少包含：`id`、`accountId`、`name`、`materialCount`、`updateTime`。

### 素材

- `GET /admin-api/mp/wecom-material/page?groupId={id}&pageNo={pageNo}&pageSize={pageSize}`
- `GET /admin-api/mp/wecom-material/get?id={id}`
- `POST /admin-api/mp/wecom-material/create`
- `PUT /admin-api/mp/wecom-material/update`
- `DELETE /admin-api/mp/wecom-material/delete?id={id}`
- `PUT /admin-api/mp/wecom-material/sort`

素材组创建和首个素材创建在同一事务中完成；后续素材通过素材接口单独维护。

创建/更新请求使用统一 DTO，按 `type` 填写对应字段：

```json
{
  "groupId": 10,
  "type": "MINI_PROGRAM",
  "textContent": null,
  "localImageUrl": "https://file.example/cover.png",
  "miniAppTitle": "活动详情",
  "miniAppAppId": "wx123456",
  "miniAppPage": "/pages/activity/detail",
  "linkTitle": null,
  "linkPicUrl": null,
  "linkDesc": null,
  "linkUrl": null
}
```

字段语义：

- `TEXT`：只使用 `textContent`。
- `IMAGE`：使用 `localImageUrl`；企业微信图片 URL由后端生成和维护，不接受管理端伪造外部素材状态。
- `MINI_PROGRAM`：使用 `localImageUrl`、`miniAppTitle`、`miniAppAppId`、`miniAppPage`；`miniAppAppId`必须是当前租户默认小程序主账户的 AppID。
- `LINK`：使用 `linkTitle`、`linkPicUrl`、`linkDesc`、`linkUrl`。

素材响应至少包含：`id`、`groupId`、`type`、`sort`、类型字段、`localImageUrl`、`updateTime`。图片响应可返回 `wecomImageUrl`，但不得返回 Secret 或 access token。

排序请求：

```json
{
  "groupId": 10,
  "materialIds": [23, 21, 25]
}
```

`materialIds` 必须完整覆盖该组未删除素材，服务端按数组顺序保存排序。

### 客户群群发

保留 `POST /admin-api/mp/wecom-customer-group/send-message`，但请求契约改为：

```json
{
  "accountId": 1,
  "tagIds": [11, 12],
  "sender": "zhangsan",
  "materialGroupId": 10
}
```

`content` 字段删除且不再接受。`materialGroupId` 必填，必须属于 `accountId`。响应继续返回：`msgId`、`targetCount`、`failedChatIds`。

## API 校验与错误语义

- 企业微信配置不存在、凭据缺失或素材组越权：拒绝请求。
- 素材组名称重复：创建/更新冲突。
- 素材类型不支持、类型字段不完整、URL 协议非法、路径格式非法：参数校验失败。
- 文字素材超过 2000 字符、一个组包含多个文字素材或非文字素材超过 9 个：业务校验失败。
- 素材组为空、素材被删除或目标群为空：禁止创建群发任务。
- 删除素材组内最后一个素材：拒绝操作，必须删除整个素材组。
- 图片同步、临时封面上传或企业微信群发接口失败：返回可读错误；不返回凭据。
- 企业微信部分目标群失败：群发任务仍返回 `msgId`，并在 `failedChatIds` 中返回失败群 ID。

错误码沿用 `yshop-module-mp` 的业务错误码模式，新增错误码名称至少包括：素材组不存在、素材不存在、素材组名称冲突、素材类型无效、素材字段无效、素材数量超限、素材图片同步失败、小程序封面上传失败、素材组群发失败。

## Database

新增 `mp_wecom_material_group`：

- `id`、`account_id`、`name`
- `creator`、`create_time`、`updater`、`update_time`、`deleted`、`tenant_id`
- 唯一约束：`tenant_id, account_id, name, deleted`
- 查询索引：`tenant_id, account_id, update_time`

新增 `mp_wecom_material`：

- `id`、`group_id`、`material_type`、`sort`
- `text_content`
- `local_image_url`、`wecom_image_url`
- `mini_app_title`、`mini_app_app_id`、`mini_app_page`
- `link_title`、`link_pic_url`、`link_desc`、`link_url`
- `creator`、`create_time`、`updater`、`update_time`、`deleted`、`tenant_id`
- 查询索引：`tenant_id, group_id, sort, deleted`

类型字段不完整和字段互斥由服务层校验；所有业务表必须包含租户标识并使用 `utf8mb4`。

迁移文件：

```text
backend/sql/upgrade-2026-08-18-wecom-material-management.sql
```

回滚：人工确认后删除角色权限和菜单，再删除素材表；不删除文件服务内容和外部企业微信素材。

## 权限与菜单

新增企业微信子菜单“素材管理”，建议路由 `mp/wecom/material/index`，组件名 `WecomMaterialManagement`。

新增权限：

- `mp:wecom-material-group:query`
- `mp:wecom-material-group:create`
- `mp:wecom-material-group:update`
- `mp:wecom-material-group:delete`
- `mp:wecom-material:query`
- `mp:wecom-material:create`
- `mp:wecom-material:update`
- `mp:wecom-material:delete`

排序复用素材更新权限。素材查询、写入和群发选择均校验租户及企业微信配置归属。

## External API

- `GET /cgi-bin/gettoken`：复用现有企业微信配置和服务端 Secret 获取 access token；凭据不出现在管理端响应和日志。
- `POST /cgi-bin/media/uploadimg`：图片素材变更时上传图片并保存企业微信返回的 `url`。
- `POST /cgi-bin/media/upload?type=image`：创建含小程序素材的群发任务时上传封面，得到临时 `media_id`；不写入素材表。
- `POST /cgi-bin/externalcontact/add_msg_template`：使用 `chat_type=group`、现有客户群 `chat_id` 列表和素材组生成的 `text`/`attachments` 创建群发任务。

群发请求形态：

```json
{
  "chat_type": "group",
  "external_userid": ["wrxxxx"],
  "sender": "zhangsan",
  "text": {"content": "文字内容"},
  "attachments": [
    {"msgtype": "image", "image": {"pic_url": "http://p.qpic.cn/..."}},
    {"msgtype": "link", "link": {"title": "标题", "picurl": "https://...", "desc": "描述", "url": "https://..."}},
    {"msgtype": "miniprogram", "miniprogram": {"title": "标题", "pic_media_id": "MEDIA_ID", "appid": "wx...", "page": "/pages/index/index"}}
  ]
}
```

`text` 没有文字素材时省略；`attachments` 没有非文字素材时省略。两者不能同时为空。

## Machine Contract

实现完成后重新生成 backend OpenAPI，并同步 `governance/CONTRACT/backend-api.json`；不得手工修改机器快照。
