# 企业微信客户联系人打标签

## 范围

管理后台客户联系人支持单个和批量添加、移除企业微信客户标签。标签必须来自企业微信客户标签库，不使用内部标签关系表。

## 接口

- `POST /admin-api/mp/wecom-customer-contact/add-tags`
- `POST /admin-api/mp/wecom-customer-contact/remove-tags`

请求体：

```json
{
  "accountId": 1,
  "contactIds": [1001, 1002],
  "tagIds": ["etm_tag_xxx"]
}
```

后端校验联系人和标签均属于当前企业微信配置，并对每个客户联系人下的每个跟进成员调用企业微信 `externalcontact/mark_tag`。成功后同步更新本地客户联系人标签快照，供列表和详情即时回显。

## 权限

新增权限：`mp:wecom-customer-contact-tag:assign`，授予租户管理员。
