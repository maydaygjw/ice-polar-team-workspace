# 分账收款人 OpenAPI 同步契约

## API

- `POST /open-api/v1/profit-recipients/sync`：通过 OAuth2 client credentials token 同步当前租户 AdaPay 分账收款人。要求现有 `payment` scope，并要求当前租户 AdaPay 配置启用 OpenAPI。
- JSON 请求字段：`memberId`（AdaPay Member ID）、`memberType`（`0` 平台商户、`1` 个人、`2` 企业）、`recipientType`（`1` 平台级、`2` 店铺级；本地尚无该 Member 时必填）、`role`（平台级必填）、`shopIds`（可选店铺 ID 数组）。平台商户使用 `memberId="0"`、`memberType=0`；平台商户不得传 `shopIds`。
- 店铺级收款人可通过 `shopIds` 同步绑定多个店铺。店铺必须属于当前租户且符合现有店铺级收款人绑定规则。其他收款人类型及已有收款人的更新/关联行为沿用管理端同步服务。
- 服务端从当前 OAuth token 取得租户，不接受租户 ID、client ID、AdaPay 配置或凭据作为请求字段；服务端使用当前租户 AdaPay 配置向 AdaPay 查询 Member 和结算账户，并复用本地同步逻辑。
- 成功响应为本地收款人 ID（Long），新导入的收款人默认禁用。同步操作对同一租户和 Member ID 复用已有记录，不创建重复收款人。
- `400` 表示请求不合法或同步数据不满足业务规则；`401` 表示 token 无效；`403` 表示客户端无 scope 或 AdaPay OpenAPI 配置未启用；AdaPay 暂时不可用时返回平台标准服务端错误。

## 权限和隔离

- 接口使用现有 `payment` scope；暂不细分 OpenAPI scope。OAuth2 客户端必须获授该 scope。
- 请求 tenant 由已验证 token 与 `tenant-id` 请求头绑定；所有本地收款人和店铺关系按该租户隔离。AdaPay 查询只使用该租户配置。
- 该接口仅同步收款人基础资料和结算账户，不发起分账或收款操作。
