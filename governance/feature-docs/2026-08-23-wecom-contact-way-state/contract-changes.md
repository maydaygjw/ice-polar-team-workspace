# 企业微信联系我 State 展示契约增量

## Admin API

现有以下接口的 `WecomContactWayRespVO` 增加可选字段：

- `GET /admin-api/mp/wecom-contact-way/page`
- `GET /admin-api/mp/wecom-contact-way/get`
- `GET /admin-api/mp/wecom-contact-way/simple-list`

新增字段：

- `state`：企业微信联系我配置同步回来的 State 原值；创建或同步前为空的历史记录允许返回 `null`。

格式约定：由当前系统创建的二维码为 `v1:t{tenantId}:r{businessRegionId}`；该字段展示企业微信实际返回值，用于排查历史二维码或旧配置。

## Database

升级脚本：`backend/sql/upgrade-2026-08-23-wecom-contact-way-state.sql`。

在 `mp_wecom_contact_way` 增加 `state varchar(255)`，保存企业微信联系我配置的 State 快照。

