# 企业微信欢迎语复用素材组与链接封面选择契约变更

## Admin API

### 欢迎语模板

欢迎语模板创建、更新请求使用必填字段 `materialGroupId`：

```json
{
  "accountId": 1,
  "businessRegionId": 10,
  "name": "新客欢迎语",
  "materialGroupId": 20
}
```

- 新建和更新模板必须提交 `materialGroupId`，素材组必须属于当前 `accountId`，且不能为空。
- 查询响应新增 `materialGroupId`。
- 一个模板仍按 `accountId + businessRegionId` 唯一，素材组可以被同一企业微信配置下多个商圈模板复用。

### 素材

`LINK` 类型的 `linkPicUrl` 仍为 URL 字段，但管理端必须通过现有图片空间组件选择图片，不再提供手工 URL 输入框。后端继续要求 `http` 或 `https` URL，兼容已有链接素材。

## External API

素材组欢迎语发送调用企业微信 `POST /cgi-bin/externalcontact/send_welcome_msg`：

- `text` 使用素材组中的唯一 `TEXT` 素材；无文字素材时省略。
- `attachments` 按素材组 `sort` 顺序发送，支持现有 `IMAGE`、`LINK`、`MINI_PROGRAM` 类型。
- 图片使用已同步的企业微信图片 URL；小程序封面在发送时上传临时图片素材并使用返回的 `media_id`。
- 文字和附件均为空时拒绝发送。
- 仍遵守 WelcomeCode 的有效期和单次调用约束，不能自动重试不确定结果。

## Database

`mp_wecom_welcome_template` 新增可空字段：

- `material_group_id bigint DEFAULT NULL`：关联 `mp_wecom_material_group.id`。

数据库中的旧版单附件列暂时保留以兼容已部署表结构，但不再由业务代码读写；欢迎语内容统一由素材组提供。

迁移文件：

```text
backend/sql/upgrade-2026-08-23-wecom-welcome-material-group.sql
```

## 权限与数据校验

- 欢迎语保存时校验素材组存在、归属企业微信配置且至少包含一条素材。
- 删除素材组时，如果仍被欢迎语模板引用则拒绝删除。
- 所有素材组和模板查询继续执行租户隔离及企业微信配置归属校验。
