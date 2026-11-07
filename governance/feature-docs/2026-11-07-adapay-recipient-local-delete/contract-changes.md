# Contract Changes — AdaPay 分账收款人本地删除

## API

- 新增 `DELETE /admin-api/pay/profit-recipient/delete-local?id={id}`，使用现有 `pay:profit-recipient:delete` 权限。
- 本地删除按现有租户隔离及已绑定分账关系校验执行；通过后逻辑删除本地分账收款人记录（包含 Member 信息快照、结算账户 ID 和结算账户快照），并按现有规则关闭本地绑定历史。
- 本地删除不调用 AdaPay 的 Member 或 SettleAccount 删除接口，不影响 AdaPay 侧 Member 和结算账户。
- 现有 `DELETE /admin-api/pay/profit-recipient/delete?id={id}` 行为不变：成功后同时删除 AdaPay 结算账户，再删除本地记录。

## 管理端

- 收款人列表保留“删除”，新增“仅本地删除”。
- “仅本地删除”二次确认明确说明 AdaPay 侧 Member 和结算账户会保留。

## 数据库

无 DDL 变更。
