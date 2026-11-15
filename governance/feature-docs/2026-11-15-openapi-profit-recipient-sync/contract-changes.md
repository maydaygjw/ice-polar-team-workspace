# 分账收款人 OpenAPI 同步契约

## API

- `POST /open-api/v1/profit-recipients/sync`：通过 OAuth2 client credentials token 同步当前租户 AdaPay 分账收款人。要求现有 `payment` scope，并要求当前租户 AdaPay 配置启用 OpenAPI。
- JSON 请求字段：`memberId`（AdaPay Member ID）、`memberType`（`0` 平台商户、`1` 个人、`2` 企业）、`recipientType`（`1` 平台级、`2` 店铺级；本地尚无该 Member 时必填）、`role`（平台级必填）、`shopIds`（可选店铺 ID 数组）。平台商户使用 `memberId="0"`、`memberType=0`；平台商户不得传 `shopIds`。
- 店铺级收款人可通过 `shopIds` 同步绑定多个店铺。OpenAPI 客户端不校验用户门店数据权限，但每个店铺仍须属于 token 所属租户；后台用户同步继续校验当前用户门店数据权限。绑定时若店铺已有不同主收款人，先将原主收款人转入该店铺“其他店铺收款人”列表，再设新收款人为主收款人；原收款人已有其他收款人关系时保留其标记，否则新增关系标为 `VALID`。若新收款人已在其他收款人列表中，则从该列表移除。店铺分账启用状态保持不变。
- 服务端从当前 OAuth token 取得租户，不接受租户 ID、client ID、AdaPay 配置或凭据作为请求字段；服务端使用当前租户 AdaPay 配置向 AdaPay 查询 Member 和结算账户，并复用本地同步逻辑。
- 成功响应为本地收款人 ID（Long），新导入的收款人直接启用。同步操作对同一租户和 Member ID 复用已有记录，不创建重复收款人；已有记录的状态不因同步而改变。
- `400` 表示请求不合法或同步数据不满足业务规则；`401` 表示 token 无效；`403` 表示客户端无 scope 或 AdaPay OpenAPI 配置未启用；AdaPay 暂时不可用时返回平台标准服务端错误。
- `POST /open-api/v1/profit-recipients/sync-if-necessary` 使用同一请求和响应 DTO。如果当前租户已有该 `memberId` 的本地记录，跳过所有 AdaPay Member/结算账户查询及本地资料更新，直接返回已有收款人 ID；若请求包含 `shopIds`，仍校验并将这些店铺绑定到已有店铺级收款人，原主收款人按上述规则转入其他收款人列表。若已有收款人为平台级，传入 `shopIds` 返回业务错误；已存在时传入的 `memberType` 必须匹配本地记录，`recipientType` 可省略，若传入则必须匹配现有类型。若本地记录不存在，则执行普通同步并绑定 `shopIds`。
- `GET /open-api/v1/profit-recipients/by-member/{memberId}`：按 AdaPay Member ID 查询当前租户本地收款人，使用相同 `payment` scope 和 AdaPay OpenAPI 配置门槛。成功响应只包括本地 ID、Member ID/类型、收款人类型/角色/名称、状态、结算账户绑定状态、企业审核状态和当前绑定店铺 ID；不返回身份证、银行卡或完整结算账户资料。记录不存在时返回收款人不存在错误。

## 权限和隔离

- 接口使用现有 `payment` scope；暂不细分 OpenAPI scope。OAuth2 客户端必须获授该 scope。
- 请求 tenant 由已验证 token 与 `tenant-id` 请求头绑定；所有本地收款人和店铺关系按该租户隔离。AdaPay 查询只使用该租户配置。
- 该接口仅同步收款人基础资料和结算账户，不发起分账或收款操作。
