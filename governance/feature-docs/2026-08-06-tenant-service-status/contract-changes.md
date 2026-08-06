# Tenant Service Status — Contract Changes

## Scope

新增独立于租户账号状态的服务状态。服务状态默认开启；关闭后仅影响当前租户的 App API，不影响管理后台，便于管理员在维护期间恢复服务。

## Database

`system_tenant.service_status`：

- `0`：开启（默认值）
- `1`：维护中
- 已有租户迁移后统一为 `0`

管理端使用当前租户专用接口，不复用全局租户管理接口，避免普通租户角色依赖 `system:tenant:*` 权限，也避免通过请求体租户 ID 越权。

| Method | Path | Request | Response | Authorization |
|---|---|---|---|---|
| `GET` | `/admin-api/system/tenant/service-status` | — | `boolean` | 登录用户角色为 `super_admin` 或 `tenant_admin`；租户从 `tenant-id` 上下文获取 |
| `PUT` | `/admin-api/system/tenant/service-status` | `{ "enabled": true }` | `boolean` | 同上 |

管理端接口只读写当前租户的 `service_status`。不接受租户 ID，不修改 `system_tenant.status`、套餐、账号、密码或过期时间。系统租户允许修改服务状态，但仍禁止通过通用租户更新接口修改租户资料。

## App API

Controller package: `controller.app`

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/app-api/system/tenant/service-status` | — | `true` |

该接口允许未登录用户调用，但仍要求 `tenant-id` 请求头，用于客户端自行展示或停止服务。

## Compatibility

- 不改变已有 `system_tenant.status` 的账号/租户合法性语义。
- 旧数据通过升级脚本补齐默认开启状态。
- 管理端服务状态接口不依赖 `system:tenant:query/update`，并且禁止跨租户写入。
- 不拦截其他接口；客户端根据该接口结果自行决定是否停止服务。
