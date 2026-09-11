# 契约变更

## API

- 新增管理端朋友圈任务分页接口：`GET /mp/wecom-moment/page`（管理端统一前缀由网关补充）。
- 新增管理端创建任务接口：`POST /mp/wecom-moment/create`。
- 新增管理端查询创建结果接口：`GET /mp/wecom-moment/get?id={id}`，查询时刷新企业微信异步创建结果。
- 创建请求包含 `accountId`、`materialGroupId`、`senderUserids`；后端按素材组快照文字和图片，不包含可见范围和定时字段。
- 创建响应返回本地任务编号；`jobid` 和初始状态在任务详情/列表中查询。
- 创建前后端均校验发表人和素材组归属；素材组只能包含 `TEXT`、`IMAGE`，图片最多 9 张，且文字和图片不能同时为空。

## DB

- 新增 `mp_wecom_moment_task`，按租户和企业微信配置保存任务、内容快照、图片媒体快照、发表人快照、`jobid`、`moment_id`、状态、错误信息及时间字段。
- 使用 `backend/sql/upgrade-2026-09-11-wecom-customer-moments.sql`；不修改基线 SQL。
- 回滚前确认没有使用该模块，再删除新增菜单权限和任务表；不删除素材文件或企业微信媒体。

## Permissions and data scope

- 新增朋友圈页面及查询、创建权限。
- 所有读写校验当前租户和 `accountId` 归属。
- 发表人只能取当前企业微信配置下已同步且仍在客户联系权限范围内的客户管理员。

## External system

- 创建：`POST /cgi-bin/externalcontact/add_moment_task`。
- 查询异步创建结果：`GET /cgi-bin/externalcontact/get_moment_task_result`。
- 图片通过企业微信临时素材上传接口获得朋友圈所需 `media_id`；当前保存的 `pic_url` 不直接作为朋友圈图片字段。
- 请求和响应仅 DEBUG 脱敏记录；明确失败返回业务错误，网络超时进入待核查状态，不自动重试。
- 企业微信任务创建频率按接口限制控制；第一版不做定时队列。
