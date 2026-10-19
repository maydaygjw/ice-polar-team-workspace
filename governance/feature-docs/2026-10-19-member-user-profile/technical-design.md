# 技术设计：外卖用户画像

## 影响范围

- `backend`：新增画像快照表、管理端分页查询接口及查询权限/菜单初始化数据。
- `admin`：新增会员菜单下的用户画像列表页及对应查询 API 封装。
- 外部导入：沿用页面外现有导数流程，导入方负责提供画像基础字段；后台新增可由 Quartz 管理的阶段计算任务，不新增导入接口。

## 数据模型

新增 `yshop_member_user_profile` 表，存储按日导入的画像快照。遵循后端多租户规范，增加 `tenant_id`。使用 `id` 作为 ORM 主键，另以 `(tenant_id, user_id, stat_date)` 唯一约束实现业务唯一性。

| 列 | 类型建议 | 约束/用途 |
|---|---|---|
| `id` | `BIGINT` | 主键，沿用项目 ID 生成约定 |
| `tenant_id` | `BIGINT` | 必填，租户隔离 |
| `user_id` | `VARCHAR(64)` | 必填，外部画像用户标识 |
| `stat_date` | `DATE` | 必填，画像统计日期 |
| `orders_3d` | `INT` | 必填，非负 |
| `orders_7d` | `INT` | 必填，非负 |
| `orders_30d` | `INT` | 必填，非负 |
| `order_days_3d` | `TINYINT` | 必填，0–3；近 3 天至少有一笔有效订单的自然日数 |
| `order_days_7d` | `TINYINT` | 必填，0–7；近 7 天至少有一笔有效订单的自然日数 |
| `is_new_user` | `BIT(1)` / `TINYINT(1)` | 必填；`1` 表示已注册但从未下单 |
| `last_order_time` | `DATETIME` | 可空 |
| `user_stage` | `VARCHAR(32)` | 可空普通列；后台阶段任务计算并写入，待计算时为空 |
| `stage_calculated_at` | `DATETIME` | 最近一次阶段计算对应的画像 `updated_at` 水位；空值表示待计算 |
| `user_tags` | `JSON` | 必填，JSON 字符串数组；无标签写 `[]` |
| `updated_at` | `DATETIME` | 必填，画像记录更新时间（由导入方提供） |
| `create_time` / `update_time` / `creator` / `updater` / `deleted` | 项目通用类型 | 按后台表基类/迁移惯例维护；不替代业务 `updated_at` |

索引：唯一索引 `(tenant_id, user_id, stat_date)`；分页查询索引 `(tenant_id, stat_date, user_stage)`；待计算扫描索引 `(tenant_id, stage_calculated_at, updated_at)`。租户过滤由标准租户拦截器和查询条件共同保障。逻辑删除字段按项目通用表约定处理，唯一键与逻辑删除兼容性应在实现时按现有 DDL 模式确认。

画像表不外键绑定会员表：`user_id` 是外部数据标识，且画像可能先于本地会员数据到达。页面展示外部 `user_id`，不联查会员表，不依赖订单表。

## 服务与查询设计

- 新增管理端只读分页查询；查询条件为 `stat_date`、精确 `user_id`、`user_stage` 和标签名。
- 标签筛选对 JSON 数组做精确字符串成员匹配，不使用子串匹配。首版可在 MySQL JSON 查询上完成；若数据量增长导致该条件成为瓶颈，再评估标签关系表或 JSON 索引方案。
- 日窗口按 `Asia/Shanghai` 自然日计算并包含 `stat_date`：3 天窗口为统计日及前 2 天，7 天窗口为统计日及前 6 天，30 天窗口为统计日及前 29 天。
- 默认按 `stat_date`、`updated_at` 倒序，其次按 `id` 倒序，保证分页顺序稳定。页面默认查询当天快照；允许清空日期查看全部日期。
- `pageSize` 使用后台统一上限（不超过 100）。所有查询必须在当前租户上下文内执行。
- `user_stage` 由后台 Quartz `JobHandler` 计算并持久化，分页筛选和返回均读取该列；外部导入方不写此列。
- 阶段按优先级计算：`is_new_user=true` → `new`；否则 `orders_3d >= 2 && order_days_3d >= 2 && order_days_7d >= 5` → `high_frequency`；否则 `orders_7d > 0` → `occasional`；否则 `orders_30d > 0` → `at_risk`；否则 → `churned`。下单天数按窗口内有有效订单的自然日去重统计，同日多单只计一天。
- 导入数据一致性约束：`orders_3d <= orders_7d <= orders_30d`、`order_days_3d <= order_days_7d`、`order_days_3d <= orders_3d`、`order_days_7d <= orders_7d`、`order_days_3d <= 3`、`order_days_7d <= 7`。若 `is_new_user=true`，订单数和下单天数均应为 0。
- 本功能不计算或纠正任何导入字段，不查询订单表或写入标签；仅新增用户阶段定时任务。

### 阶段计算

Quartz 任务 `memberUserProfileStageJob` 以 `@TenantJob` 按租户执行。每次最多扫描 500 条 `stage_calculated_at IS NULL OR stage_calculated_at < updated_at` 的记录，计算阶段后将 `stage_calculated_at` 写为本次读取的 `updated_at`。更新同时带上原 `updated_at` 条件，避免导入并发时旧结果覆盖新数据。若导入期间更新导致条件不匹配，记录会在下一轮重试。任务幂等，由数据库迁移幂等初始化为每 5 分钟执行一次，并可在后台任务管理调整；无需由订单写入流程直接触发。

## 菜单与权限

在会员/用户中心菜单下新增“用户画像”页面菜单，授权码为 `member:user-profile:query`。页面仅要求该查询权限；不创建写权限。菜单初始化使用幂等迁移，并按项目现行菜单授权规则授予系统管理员和租户管理员。租户数据边界仍由后端租户机制执行，不以隐藏菜单代替授权校验。

## 迁移与回滚

- 新增 Flyway 迁移：`backend/sql/migrations/V2026101902__member_user_profile.sql`（先确认实际最高版本号，避免与其他并行迁移冲突）。迁移创建表、索引、菜单和查询权限；迁移会幂等创建启用状态的 Quartz 任务 `memberUserProfileStageJob`，默认 Cron 为每 5 分钟执行。
- 表初始为空，无回填、计算或数据转换步骤。
- 回滚需先停止外部导入及页面访问，再按环境数据保留要求处理菜单/权限和表。删除表会丢失已导入快照，因此生产回滚默认保留表数据，仅撤销菜单入口；删除数据须作为单独的数据处置决定。

## 风险与约束

- `user_tags` JSON 成员过滤通常无法直接使用普通 B-tree 索引；先按首版规模使用，观察查询延迟。
- 导入方每次新增或更新画像基础字段时必须刷新 `updated_at`，阶段任务依赖该字段发现待计算和变更记录。
- 设计以 MySQL 支持 JSON 列为前提；外部导入方必须写入合法 JSON 字符串数组，不能写逗号拼接字符串或 `NULL`。
- 画像用户标识采用字符串，与本地会员 `Long` ID 不做隐式转换或关联。
