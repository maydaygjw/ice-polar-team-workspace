# 技术设计

- Backend 在 `yshop-module-mp` 增加客户群标签表和群-标签关联表，均包含 `tenant_id`、审计字段和软删除字段。
- 客户群分页增加 `tagIds` 查询参数，返回关联标签；批量关联接口只接受当前租户、当前企业微信配置下的群和标签。
- 企业群发复用企业微信 `externalcontact/add_msg_template`，使用 `chat_type=group`、`external_userid=[chat_id...]` 和文本消息体。
- Admin 在客户群表格中增加多选、标签列、标签筛选、群标签维护弹窗、批量打标和群发弹窗。
- 群发接口只创建企业微信任务，不承诺立即发送；保留企业微信返回的 `msgid` 与失败群 ID。
