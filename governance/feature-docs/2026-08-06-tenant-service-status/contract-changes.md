# Tenant Service Status — Contract Changes

## Scope

新增独立于租户账号状态的服务状态。服务状态默认开启；关闭后仅影响当前租户的 App API，不影响管理后台，便于管理员在维护期间恢复服务。

## Database

`system_tenant.service_status`：

- `0`：开启（默认值）
- `1`：维护中
- 已有租户迁移后统一为 `0`

后台复用已有租户详情查询和更新接口：`serviceStatus` 字段加入租户详情/保存 DTO。首页开关通过已有 `/admin-api/system/tenant/get` 和 `/admin-api/system/tenant/update` 读写，不新增管理端 REST 路由。

## App API

Controller package: `controller.app`

| Method | Path | Request | Response |
|---|---|---|---|
| `GET` | `/app-api/system/tenant/service-status` | — | `true` |

该接口允许未登录用户调用，但仍要求 `tenant-id` 请求头，用于客户端自行展示或停止服务。

## Compatibility

- 不改变已有 `system_tenant.status` 的账号/租户合法性语义。
- 旧数据通过升级脚本补齐默认开启状态。
- 不拦截其他接口；客户端根据该接口结果自行决定是否停止服务。
