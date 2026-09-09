# 企业微信推送通道契约

## API

- `GET/POST/PUT/DELETE /mp/wecom-push-channel/{page,create,update,delete}`：租户内维护商圈、Webhook 地址、备注。
- `GET /mp/wecom-push-channel/simple-list?businessRegionId=`：供定时推送选择通道。
- `POST /mp/wecom-customer-group/schedule-create` 增加 `pushChannelType`（`OFFICIAL` / `DOLPHIN_PRIVATE`）和 `pushChannelId`。
- 定时任务查询增加通道类型、通道编号和通道备注。

## Database

- 新增 `mp_wecom_push_channel`，包含 `tenant_id` 和标准审计/逻辑删除字段。
- `mp_wecom_customer_group_schedule` 增加 `push_channel_type`、`push_channel_id`；历史数据默认为 `OFFICIAL`。

## External Webhook

海豚私域使用 POST JSON。文本为 `message.msgType=text`，小程序为 `message.msgType=miniProgram`，字段以外部文档为准。

小程序账户增加三个可选字段：`username`（原始 ID）、`appName`（小程序名称）、`appIcon`（小程序图标 URL）。海豚小程序消息发送时从当前租户主小程序账户读取，已配置的字段才放入 `message.miniProgram`。
