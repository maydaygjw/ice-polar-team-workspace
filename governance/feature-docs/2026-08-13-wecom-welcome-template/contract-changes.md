# 企业微信商圈欢迎语模板契约变更

## API

新增管理端接口：

- `GET /admin-api/mp/wecom-welcome-template/page`
- `GET /admin-api/mp/wecom-welcome-template/get?id={id}`
- `POST /admin-api/mp/wecom-welcome-template/create`
- `PUT /admin-api/mp/wecom-welcome-template/update`
- `DELETE /admin-api/mp/wecom-welcome-template/delete?id={id}`
- `PUT /admin-api/mp/wecom-welcome-template/update-status?id={id}&status={status}`
- `POST /admin-api/mp/wecom-welcome-template/upload-image`，multipart：`accountId`、`file`

创建/更新请求：

```json
{
  "accountId": 1,
  "businessRegionId": 1001,
  "name": "默认商圈欢迎语",
  "textContent": "您好，欢迎添加我们！%NICKNAME%",
  "localImageUrl": "https://file.example/image.png",
  "wecomImageUrl": "http://p.qpic.cn/pic_wework/..."
}
```

响应至少包含：

```json
{
  "id": 1,
  "accountId": 1,
  "businessRegionId": 1001,
  "name": "默认商圈欢迎语",
  "textContent": "您好，欢迎添加我们！%NICKNAME%",
  "localImageUrl": "...",
  "wecomImageUrl": "...",
  "status": 0,
  "updateTime": "..."
}
```

`upload-image` 返回本地图片 URL、企业微信图片 URL、文件名和文件大小；不得返回 access token 或 Secret。

错误语义：

- 企业微信配置不存在/凭据缺失：拒绝外部图片上传。
- 商圈不存在、停用或越权：拒绝保存。
- 同一企业微信配置和商圈已有模板：创建冲突。
- 图片格式、大小或企业微信额度不满足：拒绝上传。
- 外部 API 失败：返回可读错误并保留原有模板。

## DB

新增 `mp_wecom_welcome_template`，包含：

- `tenant_id`、`account_id`、`business_region_id`
- `name`、`text_content`
- `local_image_url`、`wecom_image_url`
- `status`
- `creator`、`create_time`、`updater`、`update_time`、`deleted`

约束和索引：

- 唯一索引：`tenant_id, account_id, business_region_id, deleted`
- 查询索引：`tenant_id, account_id, business_region_id, status`
- 表必须使用 `utf8mb4`，并继承租户 BaseDO 约定。

迁移文件：

```text
backend/sql/upgrade-2026-08-13-wecom-welcome-template.sql
```

迁移必须提供人工确认后的回滚注释；不得修改基线 SQL。

## 权限与数据范围

新增权限：

- `mp:wecom-welcome-template:query`
- `mp:wecom-welcome-template:create`
- `mp:wecom-welcome-template:update`
- `mp:wecom-welcome-template:delete`

模板查询和写入必须校验租户、企业微信配置归属及当前用户可见的启用商圈；本期不新增部门字段，沿用商圈查询 API 的权限边界。

## 外部系统

- `POST /cgi-bin/media/uploadimg`：上传图片并取得企业微信 `url`。
- 本期不调用 `group_welcome_template/add/edit/get/del`，因为该接口用于客户群入群欢迎语。
- 本期不调用 `/cgi-bin/externalcontact/send_welcome_msg`；发送在后续客户添加外部联系人事件中处理。

## 机器契约

实现完成后重新生成 backend OpenAPI，并同步 `governance/CONTRACT/backend-api.json`；不手工维护机器快照。
