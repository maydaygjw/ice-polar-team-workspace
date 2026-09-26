# 会员外部用户 ID 契约变更

## 管理端接口

- `GET /admin-api/member/user/page` 的会员响应新增 `externalUserId: string | null`。
- `GET /admin-api/member/user/page` 支持按 `externalUserId` 精确查询会员。
- `GET /admin-api/member/user/page` 支持按 `openid`（匹配公众号或小程序 OpenID）和 `unionId` 精确查询会员。
- `GET /admin-api/member/user/get?id={id}` 的会员详情响应新增 `externalUserId: string | null`。
- `POST /admin-api/member/user/create` 和 `PUT /admin-api/member/user/update` 支持传入可选字段 `externalUserId`。
- 管理端会员列表、详情和编辑表单展示或维护该字段；为空时展示 `-`。

## 数据约束

- 字段落在 `yshop_user.external_user_id`，长度最多 128 个字符，可为空。
- 当前仅保存一个外部系统用户 ID，不新增外部系统类型，不改变现有微信 `union_id` 和企业微信客户联系人关联逻辑。
- 本期不修改 miniapp。
