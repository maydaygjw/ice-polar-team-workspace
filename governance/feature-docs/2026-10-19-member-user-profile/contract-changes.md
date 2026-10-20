# 契约变更：外卖用户画像

## 数据库

- 新增 `yshop_member_user_profile`，保存外部导入的每用户最新画像，不保存历史版本。
- 外部系统用户标识存放在 `external_user_id`；租户内业务唯一键：`(tenant_id, external_user_id)`；每次导入覆盖该用户现有画像；表增加唯一约束及按阶段查询的索引。
- 新增必填 `is_new_user`，`true` 表示用户已注册但从未下单；有过下单则为 `false`。
- 新增必填 `order_days_3d`（0–3）和 `order_days_7d`（0–7），分别统计近 3/7 天有至少一笔有效订单的自然日数，同日多单只计一天。
- `user_tags` 为必填 JSON 字符串数组，无标签统一写 `[]`。订单指标和 `is_new_user` 由外部导入方提供；外部导入方不写 `user_stage`，每次导入/更新必须刷新 `updated_at`。Quartz handler `memberUserProfileStageJob` 按阶段算法异步写入 `user_stage`，并用 `stage_calculated_at` 记录已计算到的源更新时间。
- 页面不提供导入、写入、修改或删除接口；画像不保留统计日期和历史版本。
- `yshop_user` 新增可空 `primary_business_region_code`，由外部同步维护。升级脚本只新增字段，不回填既有会员；后端会员管理和用户画像接口只读取并返回该字段，不计算或更新该字段。

## 管理端 API

### 分页查询

`GET /admin-api/member/user-profile/page`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `pageNo` | integer | 是 | 页码，沿用后台分页约定 |
| `pageSize` | integer | 是 | 每页条数，最大 100 |
| `externalUserId` | string | 否 | 外部系统用户标识，精确匹配 |
| `memberId` | integer | 否 | 平台会员 ID，精确匹配；后端按当前租户的 `yshop_user.external_user_id` 关联画像的外部用户标识 |
| `primaryBusinessRegionCode` | string | 否 | 会员主商圈代码，精确匹配；仅返回已关联该商圈会员的画像 |
| `isNewUser` | boolean | 否 | 新用户筛选；`true` 表示已注册未下单 |
| `userStage` | string | 否 | 阶段编码精确匹配 |
| `tagName` | string | 否 | 标签数组成员精确匹配 |

返回后台统一 `PageResult`，每条记录包含：

```json
{
  "id": 10001,
  "externalUserId": "U1001",
  "memberId": 324042,
  "primaryBusinessRegionCode": "REGION001",
  "registerTime": "2025-08-12 09:10:00",
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

`externalUserId` 对应数据库列 `external_user_id`，是画像导入的外部系统用户标识；`memberId` 是通过当前租户会员表关联得到的内部会员 ID，未匹配到会员时为 `null`。同时返回 `registerTime`（注册时间）、`primaryBusinessRegionCode`（主商圈代码）及会员详情路由所需标识；管理端展示注册时间和主商圈代码，并将已关联会员 ID 链接到会员信息页。会员管理分页响应也返回 `primaryBusinessRegionCode` 并展示该字段，且支持按主商圈代码精确筛选。画像列表和阶段分布接口均支持按主商圈代码筛选。列表支持按 `memberId` 精确筛选及按 `isNewUser` 筛选。`lastOrderTime` 可为 `null`；`userTags` 始终返回数组。用户阶段由后端按近 7 天订单数和下单天数计算；注册未满 7 天且仅下单 1 次的用户归为新用户。阶段编码、中文名称和颜色统一由后端 `MemberUserProfileStageEnum` 维护，管理端通过阶段选项 API 获取，不再依赖系统数据字典。查询按当前登录管理员的租户隔离。默认排序为业务更新时间和 ID 倒序。

### 阶段选项

`GET /admin-api/member/user-profile/stage-options`

无查询参数。返回全部阶段，按枚举顺序排列。拥有 `member:user-profile:query` 或 `activity:registration:query` 权限的后台用户可调用。

```json
[
  { "code": "high_frequency", "label": "高频用户", "color": "#67c23a" },
  { "code": "mid_frequency", "label": "中频用户", "color": "#409eff" },
  { "code": "low_frequency", "label": "低频用户", "color": "#909399" },
  { "code": "at_risk", "label": "流失中", "color": "#e6a23c" },
  { "code": "churned", "label": "已流失", "color": "#f56c6c" },
  { "code": "new", "label": "新用户", "color": "#36a3a8" }
]
```

## 权限与菜单

### 用户阶段分布

`GET /admin-api/member/user-profile/stage-distribution`

查询参数与分页查询的筛选参数一致（`externalUserId`、`memberId`、`primaryBusinessRegionCode`、`isNewUser`、`userStage`、`tagName`），不接收分页参数。后端在当前租户范围内对全部符合条件的画像记录按 `user_stage` 分组统计，不受列表页码和每页条数影响。响应为数组，每项包含阶段编码 `stage`、记录数 `count`；阶段名称和颜色由阶段选项 API 提供。此接口只返回统计结果，不返回用户明细。查询权限为 `member:user-profile:query`。

- 查询权限：`member:user-profile:query`。
- 菜单位于会员/用户中心菜单下，组件路由由系统菜单配置加载。
- 不定义新增、修改、删除、导入或导出权限及 API。

## 兼容性

新增表、查询 API 和菜单，不改变现有接口。画像导入 SQL 必须省略 `user_stage` 和 `stage_calculated_at`；导入每次更新基础画像字段时必须刷新 `updated_at`，阶段任务随后计算并写回。迁移会初始化为启用状态并每 5 分钟运行一次；阶段任务分批读取并持续处理全部待计算画像。该功能不要求修改平台级 `ARCHITECTURE.md`。
