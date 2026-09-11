# 会员 UnionID 展示与企业微信客户匹配

## 现有管理端契约

- `GET /admin-api/member/user/page` 的会员响应包含 `unionId: string | null`。
- `GET /admin-api/member/user/get` 的会员详情响应包含 `unionId: string | null`。
- 管理端会员列表和详情展示该字段；UnionID 为空时显示 `-`。
- 会员列表/详情响应新增 `wecomCustomerContacts`，返回当前租户内已按 `member_id` 关联的企微客户摘要：`id`、`memberId`、`accountId`、`accountName`、`externalUserId`、`name`、`matchStatus`。
- 列表以关联数量展示，详情展示每条关联的客户名称和企微配置；未关联时显示 `-`。一个会员允许关联多个企微配置下的客户记录。

## 企业微信客户匹配

- 企业微信客户同步从客户详情读取 `unionid`，保存到 `mp_wecom_customer_contact.union_id`。
- 同步按当前租户的 `member_user.union_id` 查询会员：唯一命中时写入 `member_id` 并将 `match_status` 设为 `MATCHED`；无命中为 `UNMATCHED`；多会员命中为 `AMBIGUOUS`，不绑定会员。
- 匹配仅在客户联系人同步时执行，不通过企业微信接口使用 UnionID 反查客户；企业微信侧的客户标识仍为 `external_userid`。
- 企业微信客户管理页面继续仅展示脱敏后的 UnionID。

## 数据与安全

- 本次无数据库结构变更；沿用 `backend/sql/upgrade-2026-07-31-wecom-customer-contact-sync.sql` 中的 `union_id` 字段及索引。
- UnionID 属于微信生态身份标识，后端已有会员管理权限控制；前端仅在会员管理页面展示已授权响应中的值。
