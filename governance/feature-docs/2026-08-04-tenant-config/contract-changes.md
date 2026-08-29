# 租户参数管理契约

## 目标

在管理后台的“租户管理”下增加“租户参数管理”，维护指定租户的参数配置。现有 `infra_config` 继续作为系统级全局参数，不修改其语义。

## 权限与数据隔离

- API 前缀：`/admin-api/infra/tenant-config`。
- 所有管理接口要求 `super_admin` 角色，并分别校验 `infra:tenant-config:query/create/update/delete/export` 权限。
- 请求必须携带 `tenantId`；后端校验目标租户有效后，在该租户上下文中执行数据库操作。
- 参数表包含 `tenant_id`，参数键在同一租户内唯一；不同租户可以使用相同参数键。
- 不允许通过请求头切换当前登录用户的租户；目标租户只作为受保护的管理操作参数使用。

## API

### 租户列表

`GET /admin-api/system/tenant/simple-list`

返回所有可用租户的 `{ id, name }`，用于管理端租户选择器。要求 `system:tenant:query` 权限。

### 参数分页

`GET /admin-api/infra/tenant-config/page`

请求参数：`tenantId`（必填）、`pageNo`、`pageSize`、`name`、`key`、`type`、`createTime`。

响应字段：`id`、`tenantId`、`category`、`name`、`key`、`value`、`type`、`visible`、`remark`、`createTime`。

### App 查询参数值

`GET /app-api/infra/tenant-config/value?category={category}&key={key}`，请求头携带 `tenant-id: {tenantId}`。

- 从请求头 `tenant-id` 读取租户编号，不在 query/body 中接收 `tenantId`。
- 已登录用户请求时，租户过滤器会校验请求头租户编号与用户所属租户一致，禁止越权。
- `category` 和 `key` 均为必填，并按当前租户精确匹配。
- 仅允许返回 `visible=true` 的参数；参数不存在时返回 `data: null`。
- 响应数据为参数值字符串。

### 参数详情

`GET /admin-api/infra/tenant-config/get?id={id}&tenantId={tenantId}`

### 创建参数

`POST /admin-api/infra/tenant-config/create`

请求体：`tenantId`、`category`、`name`、`key`、`value`、`visible`、`remark`。

### 修改参数

`PUT /admin-api/infra/tenant-config/update`

请求体：`id`、`tenantId`、`category`、`name`、`key`、`value`、`visible`、`remark`。

### 删除参数

`DELETE /admin-api/infra/tenant-config/delete?id={id}&tenantId={tenantId}`

系统类型参数不可删除。

### 导出参数

`GET /admin-api/infra/tenant-config/export`

请求参数与分页接口一致，导出指定租户的参数配置。

## 菜单

在“租户管理”下增加“租户参数管理”页面，路由 `tenant/config`，组件 `infra/tenantConfig/index`。菜单权限使用上述五个 `infra:tenant-config:*` 权限，仅授权系统超级管理员。
