# 契约变更

## Database

- `mp_wecom_customer_group_tag`：企业微信配置范围内的群标签。
- `mp_wecom_customer_group_tag_rel`：客户群与群标签多对多关联。

## Admin API

- `GET /mp/wecom-customer-group-tag/list?accountId=`
- `POST /mp/wecom-customer-group-tag/create`
- `PUT /mp/wecom-customer-group-tag/update`
- `DELETE /mp/wecom-customer-group-tag/delete?id=`
- `POST /mp/wecom-customer-group/batch-add-tags`
- `POST /mp/wecom-customer-group/batch-remove-tags`
- `POST /mp/wecom-customer-group/send-message`
- `GET /mp/wecom-customer-group/page` 新增 `tagIds` 查询参数并返回 `tags`。

## External API

调用企业微信 `/cgi-bin/externalcontact/add_msg_template`，以 `chat_type=group` 和客户群 `chat_id` 列表创建群发任务。企业微信仍要求成员确认后发送。
