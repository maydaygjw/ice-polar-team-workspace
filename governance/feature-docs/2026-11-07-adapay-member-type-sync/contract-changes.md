# Contract Changes — AdaPay 分账收款人同步类型选择

## API

`POST /admin-api/pay/profit-recipient/sync` 保留现有路由、权限和响应；请求新增必填字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `memberId` | string | 是 | AdaPay Member ID |
| `memberType` | integer enum | 条件必填 | 非 `0` Member ID 必须为 `1` 个人或 `2` 企业；`memberId="0"` 时固定为 `0`（平台商户），不调用 Member 查询接口 |
| `recipientType` | integer | 新收款人时是 | 本地归属级别：`1` 平台级，`2` 店铺级；与 `memberType` 含义不同 |
| `role` | integer | 新的平台级收款人时是 | 平台级分账角色 |
| `shopId` | integer | 新的店铺级收款人时是 | 关联店铺 ID |

后端按 `memberType=1` 调用 `Member.query`，按 `memberType=2` 调用 `CorpMember.query`。两个接口分别按 `app_id` 和 `member_id` 查询。后端不得仅凭 `member_id`、`object` 或结算账户类型推断 Member 类型，也不得在所选接口失败后自动切换到另一个类型。`memberId="0"` 表示当前租户的 AdaPay 平台商户，必须同时传 `memberType=0`；绕过 Member 查询并同步为平台级“平台”收款人，Member 类型固定为 `0`。

`memberId="0"` 与其他 Member 类型组合不匹配时，请求返回 `PROFIT_RECIPIENT_MEMBER_TYPE_INVALID`（`1008009038`），不得查询 AdaPay 或更新本地记录。

普通 Member 只有所选接口返回成功状态且 `member_id` 与请求一致时，才同步该类型的 Member 信息和结算账户。平台商户 `memberId="0"` 使用 AdaPay 平台商户基本账户作为收款账户，不创建单独的结算账户对象，本地标记为已绑定且 `settleAccountId` 为空；平台商户银行卡详情不通过该接口读取或持久化。失败时不得新增或更新本地收款人。重新同步普通 Member 时，以本次明确选择的 `memberType` 更新 Member 类型及对应资料；本地收款人 ID、级别、角色、店铺归属和状态沿用既有规则。重新同步平台商户时固定归属平台级“平台”角色并清空店铺归属，沿用已有状态和本地收款人 ID。

## 管理端

“同步 AdaPay 分账收款人”表单根据 Member ID 决定同步主体：输入 `0` 时将 Member 类型锁定为“平台商户”，并固定级别为平台级、角色为平台；其他 Member ID 要求明确选择个人/企业类型。Member 类型不同于本地收款人级别（平台级/店铺级）。

## 数据库

无 DDL 变更。
