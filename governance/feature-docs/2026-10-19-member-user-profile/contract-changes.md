# 契约变更：外卖用户画像

## 数据库

- 新增 `yshop_member_user_profile`，保存外部导入的每日用户画像快照。
- 租户内业务唯一键：`(tenant_id, user_id, stat_date)`；表增加唯一约束及按统计日期/阶段查询的索引。
- 新增必填 `is_new_user`，`true` 表示用户已注册但从未下单；有过下单则为 `false`。
- 新增必填 `order_days_3d`（0–3）和 `order_days_7d`（0–7），分别统计近 3/7 天有至少一笔有效订单的自然日数，同日多单只计一天。
- `user_tags` 为必填 JSON 字符串数组，无标签统一写 `[]`。订单指标和 `is_new_user` 由外部导入方提供；外部导入方不写 `user_stage`，每次导入/更新必须刷新 `updated_at`。Quartz handler `memberUserProfileStageJob` 按阶段算法异步写入 `user_stage`，并用 `stage_calculated_at` 记录已计算到的源更新时间。
- 页面不提供导入、写入、修改或删除接口。

## 管理端 API

### 分页查询

`GET /admin-api/member/user-profile/page`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `pageNo` | integer | 是 | 页码，沿用后台分页约定 |
| `pageSize` | integer | 是 | 每页条数，最大 100 |
| `statDate` | string | 否 | `YYYY-MM-DD`，精确匹配 |
| `userId` | string | 否 | 用户标识，精确匹配 |
| `userStage` | string | 否 | 阶段编码精确匹配 |
| `tagName` | string | 否 | 标签数组成员精确匹配 |

返回后台统一 `PageResult`，每条记录包含：

```json
{
  "id": 10001,
  "userId": "U1001",
  "statDate": "2026-10-19",
  "orders3d": 3,
  "orders7d": 6,
  "orders30d": 18,
  "orderDays3d": 2,
  "orderDays7d": 5,
  "isNewUser": false,
  "lastOrderTime": "2026-10-19 12:30:00",
  "userStage": "high_frequency",
  "userTags": ["早餐用户", "夜宵用户"],
  "updatedAt": "2026-10-19 06:00:00"
}
```

`lastOrderTime` 可为 `null`；`userTags` 始终返回数组。`isNewUser=true` 表示已注册但从未下单，对应阶段 `new`；高频阶段需满足近 3 天至少 2 单、至少 2 个下单日且近 7 天至少 5 个下单日；其他阶段为 `occasional`、`at_risk`、`churned`。不再使用 `never_ordered` 阶段。查询按当前登录管理员的租户隔离。默认排序为统计日期、业务更新时间和 ID 倒序。

## 权限与菜单

- 查询权限：`member:user-profile:query`。
- 菜单位于会员/用户中心菜单下，组件路由由系统菜单配置加载。
- 不定义新增、修改、删除、导入或导出权限及 API。

## 兼容性

新增表、查询 API 和菜单，不改变现有接口。画像导入 SQL 必须省略 `user_stage` 和 `stage_calculated_at`；导入每次更新基础画像字段时必须刷新 `updated_at`，阶段任务随后计算并写回。迁移会初始化为启用状态并每 5 分钟运行一次。该功能不要求修改平台级 `ARCHITECTURE.md`。
