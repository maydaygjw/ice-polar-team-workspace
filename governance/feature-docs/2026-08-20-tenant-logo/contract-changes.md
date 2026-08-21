# 租户 Logo 契约变化

## 范围

- 目标仓库：`backend`、`admin`。
- 租户 Logo 由管理端租户管理页面上传并保存。
- 登录后的管理端首页顶部租户信息区域展示当前租户 Logo；未配置 Logo 时继续展示默认楼宇图标。

## 文件上传

复用现有文件服务接口，不新增租户专用上传接口：

```text
POST /admin-api/infra/file/upload
Content-Type: multipart/form-data
```

返回值沿用现有通用响应，`data` 为可访问的文件 URL。管理端仅允许图片类型，单张图片最大 5 MB（沿用 `UploadImg` 组件的压缩和校验规则）。

## 租户 API

以下现有接口的 DTO 增加可选字段 `logo`：

| Method | Path | 变更 |
|---|---|---|
| `POST` | `/admin-api/system/tenant/create` | 请求体可传 `logo` 图片 URL |
| `PUT` | `/admin-api/system/tenant/update` | 请求体可传 `logo` 图片 URL；空字符串表示清除 |
| `GET` | `/admin-api/system/tenant/get` | 响应增加 `logo` |
| `GET` | `/admin-api/system/tenant/current-info` | 响应增加 `logo`，供首页展示 |

`logo` 类型为字符串 URL，最大长度 500；为空时客户端使用默认图标。Logo 随租户资料保存，不接受额外的租户 ID，也不改变租户隔离规则。

## 数据库

`system_tenant.logo`：

- `varchar(500)`，允许为空；
- 保存文件服务返回的 URL，不保存图片二进制；
- 迁移脚本：`backend/sql/upgrade-2026-08-20-tenant-logo.sql`；
- 回滚：删除 `logo` 列前需确认已停止使用该字段，并人工执行对应 `ALTER TABLE`，不删除文件服务中的历史文件。

## 兼容性

- 旧租户数据的 `logo` 为空，不影响现有页面和 API 调用。
- 租户精简信息 DTO 增加 `logo` 为可选响应字段，不影响只读取 `id`、`name` 的调用方。
