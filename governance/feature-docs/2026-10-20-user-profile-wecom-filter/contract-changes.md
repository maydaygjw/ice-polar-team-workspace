# 契约变更：用户画像企微关联筛选

## 用户画像管理端 API

`GET /admin-api/member/user-profile/page` 和 `GET /admin-api/member/user-profile/stage-distribution` 新增可选查询参数 `wecomCustomer`（Boolean），用于筛选是否关联企业微信客户。关联判定为当前租户画像关联的会员存在企微联系人：联系人按会员 ID 或 UnionID 关联。分页响应新增 `wecomCustomer` Boolean 字段。未匹配到平台会员的画像返回 `false`。

查询仍受当前租户隔离，现有页面权限和接口路径不变，不新增数据库字段、权限或迁移脚本。
