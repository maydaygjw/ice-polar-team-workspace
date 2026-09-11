# 会员企微客户筛选

## 后端接口

会员分页接口 `GET /member/user/page` 新增可选查询参数 `wecomCustomer`：

- 未传值：返回全部会员，保持现有行为。
- `true`：仅返回存在至少一条 `mp_wecom_customer_contact` 记录，且 `match_status = MATCHED`、`member_id` 对应该会员的会员。
- `false`：仅返回不存在上述关联记录的会员。

该筛选与响应中的 `wecomCustomerContacts` 字段保持一致；该字段仍只返回已匹配的企微客户关联记录，不改变响应结构。

## 前端

管理端会员管理搜索栏新增“企微客户”筛选项，支持“是 / 否 / 全部”。
