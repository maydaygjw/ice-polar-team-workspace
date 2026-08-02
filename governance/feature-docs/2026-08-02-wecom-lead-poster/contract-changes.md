# 引流海报契约变更

## API

### 新增后台接口

- `POST /admin-api/mp/wecom-contact-way/sync?accountId={id}`：同步企业微信已有永久联系我配置。
- `GET /admin-api/mp/wecom-contact-way/page`：分页查询同步记录。
- `GET /admin-api/mp/wecom-contact-way/simple-list`：查询可选二维码。
- `GET /admin-api/mp/wecom-contact-way/get?id={id}`：查询二维码详情。
- `POST /admin-api/mp/wecom-contact-way/create`：调用企业微信创建二维码联系我配置并保存本地快照。
- `PUT /admin-api/mp/wecom-contact-way/update`：调用企业微信更新联系我配置并刷新本地快照。
- `DELETE /admin-api/mp/wecom-contact-way/delete?id={id}`：调用企业微信删除联系我配置并删除本地记录。
- `POST /admin-api/mp/wecom-lead-poster/create`：保存前端生成并上传的海报。
- `PUT /admin-api/mp/wecom-lead-poster/update`：保存前端重新编辑并上传的海报。
- `DELETE /admin-api/mp/wecom-lead-poster/delete?id={id}`：逻辑删除海报。
- `GET /admin-api/mp/wecom-lead-poster/page`：分页查询海报。
- `GET /admin-api/mp/wecom-lead-poster/get?id={id}`：查询海报详情。
- `PUT /admin-api/mp/wecom-lead-poster/update-status?id={id}&status={status}`：启用/停用海报。

### DTO 语义

- 联系我同步以 `accountId` 为输入；响应返回处理总数、新增数、更新数、失败数和失败原因。
- 联系我创建请求包含企业微信配置、单人/多人类型、成员 UserID 或部门 ID、备注和添加好友验证配置；本期仅支持二维码场景。
- 联系我更新以本地记录 ID 定位，`config_id` 由企业微信生成且不可修改；新增、编辑、删除均以企业微信接口成功为前提更新本地记录。
- 海报保存请求包含最终图片地址、背景图地址、联系我记录 ID、商圈 ID 和二维码 `qrX`、`qrY`、`qrSize`；本期模板版本由后端固定为 `frontend-v1`。
- 海报响应包含最终图片地址、商圈、联系我记录、状态、模板版本和二维码几何参数。
- 所有响应使用 `{code,data,msg}` 通用包装。
- 本期不新增 `/app-api` 接口。

### 错误语义

- 企业微信配置不存在或缺少客户联系权限：同步失败，不能创建同步记录。
- 企业微信分页/详情调用失败：返回部分成功结果，并保留失败原因。
- 联系我配置不可用、二维码地址为空或二维码快照下载失败：禁止选择或生成。
- 商圈不存在、停用或无数据权限：拒绝创建/更新海报。
- 二维码位置或尺寸超出 `1125 × 1500` 画布：拒绝保存并提示调整。
- 前端 Canvas 导出失败或 OSS 上传失败：不调用保存接口，保留编辑状态并提示重试。

### 幂等和兼容性

- 联系我同步按 `tenant_id + account_id + config_id` 幂等。
- 海报创建每次生成一个业务记录；更新只更新当前海报，不修改历史海报的图片快照。
- 新接口不改变现有企业微信账号、客户群、客户联系人和小程序广告接口。

## DB

### 新增表

- `mp_wecom_contact_way`：保存联系我配置、二维码当前信息和本地二维码快照。
- `mp_wecom_lead_poster`：保存背景图、二维码快照、二维码几何参数、商圈范围和最终图片地址。

两张表必须包含 `tenant_id`、逻辑删除字段、审计字段和必要索引；本期不增加 `dept_id`，商圈只作为筛选/归属元数据。

### 迁移和回滚

- 文件：`backend/sql/upgrade-2026-08-02-wecom-lead-poster.sql`。
- 禁止修改 `backend/sql/yixiang-drink.sql`。
- 迁移脚本需要提供新增表和索引的回滚语句。

## 权限与数据范围

新增权限：

- `mp:wecom-lead-poster:query`
- `mp:wecom-lead-poster:create`
- `mp:wecom-lead-poster:update`
- `mp:wecom-lead-poster:delete`
- `mp:wecom-contact-way:query`
- `mp:wecom-contact-way:sync`
- `mp:wecom-contact-way:create`
- `mp:wecom-contact-way:update`
- `mp:wecom-contact-way:delete`

海报必须校验租户、商圈启用状态和二维码所属企业微信账号；商圈不绘制到图片。

## 依赖

- `yshop-module-mp-biz` 增加对 `yshop-module-store-api` 的 API 依赖，禁止直接依赖 `store-biz`。
- 不新增图片处理、二维码解码、AI、MQ 或小程序依赖。
- 前端复用现有文件上传接口；后端不读取图片内容。

## 外部系统：企业微信

- `POST /cgi-bin/externalcontact/list_contact_way`：分页获取联系我配置 ID。
- `POST /cgi-bin/externalcontact/get_contact_way`：获取配置详情和二维码地址。
- `POST /cgi-bin/externalcontact/add_contact_way`：创建二维码联系我配置。
- `POST /cgi-bin/externalcontact/update_contact_way`：更新联系我配置。
- `POST /cgi-bin/externalcontact/del_contact_way`：删除联系我配置。
- 认证沿用现有企业微信账号的 CorpID、客户联系 Secret 和服务端 access token 缓存。
- 前端不接触 Secret/access token。
- 网络错误和服务端错误有限重试；权限、参数和配置不存在等业务错误不重试。
- 企业微信配置以 `config_id` 做幂等键；临时会话和仅小程序按钮配置不纳入本期。

## 机器契约

实现完成后重新生成 `backend/openapi.json`，再同步更新 `governance/CONTRACT/backend-api.json`。本阶段不手工修改机器快照。
