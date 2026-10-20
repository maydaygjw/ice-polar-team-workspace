# 会员详情企业微信信息

## 管理端接口

现有 `GET /admin-api/member/user/get?id={id}` 的 `wecomCustomerContacts` 增加企业微信客户资料字段：`avatar`、`type`、`gender`、`corpName`、`corpFullName` 和 `lastSyncTime`；原有 `id`、`accountId`、`accountName`、`externalUserId`、`name`、`matchStatus` 保持不变。

详情接口返回当前租户内以下联系人：

- 已匹配到该会员 ID 的联系人。
- 当会员有 UnionID 时，UnionID 相同的联系人，包括尚未匹配或匹配状态不明确的联系人。

同一联系人按联系人记录 ID 去重。没有可关联联系人时返回空数组。联系人查询不调用企业微信实时接口，只读取本地同步快照；不返回 Secret、access token 或未脱敏的 UnionID。

接口继续使用会员详情现有的 `member:user:query` 权限，无新增权限或数据库字段。
