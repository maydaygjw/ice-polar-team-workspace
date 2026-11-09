# Contract Changes — AdaPay 企业 Member 审核状态同步

## API

- 分账收款人查询接口响应新增只读可空字段 `memberAuditState`（审核状态枚举）、`memberAuditDesc`。字段属于收款人响应，不属于创建/更新请求。
- 仅 `memberType=2` 的企业 Member 填充字段；`memberType=1` 的个人 Member 和 `memberType=0` 的平台商户返回 `null`。
- `POST /admin-api/pay/profit-recipient/sync` 同步企业 Member 时，将同租户 AdaPay 配置下 `CorpMember.query` 返回的 `audit_state` 和 `audit_desc` 原样保存并返回。重复同步刷新这两个快照；切换同步为个人 Member 或平台商户时清空旧值。
- `memberAuditState` 使用 AdaPay 状态码：`A` 待审核、`B` 审核失败、`C` 开户失败、`D` 开户成功但未创建结算账户、`E` 开户和创建结算账户成功。`memberAuditDesc` 保存 AdaPay 返回的状态说明，不自行推断审核结果。
- 管理后台收款人详情仅对企业 Member 显示审核状态及审核说明；未知 AdaPay 状态码映射为 `UNKNOWN`，页面显示“未知状态”，不推断业务结果。

## Database

- `yshop_adapay_profit_recipient` 新增可空 `member_audit_state VARCHAR(16)` 和 `member_audit_desc VARCHAR(128)` 字段，保存最近一次企业同步返回的审核状态快照。
- 不回填历史状态；个人 Member 和平台商户保持 `NULL`。
