# Contract Changes — AdaPay 分账收款人同步类型选择

## API

`POST /admin-api/pay/profit-recipient/sync` 保留现有路由、权限和响应；请求新增必填字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `memberId` | string | 是 | AdaPay Member ID |
| `memberType` | integer enum | 是 | `1` 个人，`2` 企业；对应后端 `ProfitRecipientMemberTypeEnum`，决定调用的 AdaPay 查询接口 |
| `recipientType` | integer | 新收款人时是 | 本地归属级别：`1` 平台级，`2` 店铺级；与 `memberType` 含义不同 |
| `role` | integer | 新的平台级收款人时是 | 平台级分账角色 |
| `shopId` | integer | 新的店铺级收款人时是 | 关联店铺 ID |

后端按 `memberType=1` 调用 `Member.query`，按 `memberType=2` 调用 `CorpMember.query`。两个接口分别按 `app_id` 和 `member_id` 查询。后端不得仅凭 `member_id`、`object` 或结算账户类型推断 Member 类型，也不得在所选接口失败后自动切换到另一个类型。

只有所选接口返回成功状态且 `member_id` 与请求一致时，才同步该类型的 Member 信息和结算账户。失败时不得新增或更新本地收款人。重新同步已存在的记录时，以本次明确选择的 `memberType` 更新 Member 类型及对应资料；本地收款人 ID、级别、角色、店铺归属和状态沿用既有规则。

## 管理端

“同步 AdaPay 分账收款人”表单在 Member ID 之外要求选择 Member 类型（个人/企业），并随请求提交 `memberType`。该选择不同于本地收款人级别（平台级/店铺级），两个字段都需独立呈现和校验。不存在默认类型，须由操作人明确选择。

## 数据库

无 DDL 变更。
