# 会员最近活动时间契约变更

## Admin API

会员接口保持不变：

- `GET /admin-api/member/user/page`
- `GET /admin-api/member/user/get?id={id}`

列表和详情响应增加：

```json
{
  "lastOrderTime": "2026-09-11 10:30:00",
  "lastLoginTime": "2026-09-11 11:00:00"
}
```

- `lastOrderTime`：最近一次支付成功订单的时间；从未支付成功时为 `null`。
- `lastLoginTime`：最近一次登录成功的时间；从未登录成功时为 `null`。
- 时间格式沿用现有管理端 `LocalDateTime` JSON 格式。

## Database

`yshop_user` 新增：

- `last_order_time datetime NULL`：最近一次支付成功订单时间。
- `last_login_time datetime NULL`：最近一次登录成功时间。

升级脚本为 `backend/sql/upgrade-2026-09-11-member-activity-time.sql`。历史 `login_date` 回填至 `last_login_time`；最近下单时间不对历史订单做强制回填，后续支付成功时开始记录。

## Behavior

- 会员登录成功后，原有 `login_date` 与新字段 `last_login_time` 同步更新。
- 订单支付成功后，`pay_count` 增加 1，同时更新 `last_order_time`。
- 字段继续使用现有会员表租户隔离和软删除规则。
