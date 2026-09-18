# 活动管理重构契约变更

## API

统一前缀保持 `/admin-api/activity` 和 `/app-api/activity`。

### 管理端

- `GET /condition/page`：查询当前租户可用/已配置的条件类型及状态。
- `POST /condition/enable`：启用或停用租户可用的内置条件；请求包含 `type`、`enabled`。
- `GET /condition/types`：返回可被模板选择的条件元数据、类别（`BUILT_IN` 内置或 `EXTENSION` 扩展）、说明和版本。
- 条件类型只读：展示后端注册的类型元数据；条件实例的名称、说明和参数由条件实例 CRUD 管理。
- 模板创建/更新请求新增 `conditions`，每项包含唯一 `conditionId`、`type`、`sort`、`config`；同一 `type` 可以出现多个条件实例。旧 `checkWecomAdmin`、`checkGroupMember` 请求字段过渡期可读写，但后端统一转换为条件配置。
- 模板详情/分页响应新增 `conditions`；保留旧 Boolean 字段，供旧前端兼容。
- 期次详情响应新增快照条件列表；报名记录响应新增结构化 `conditionResults`。
- 原有 `/template/*`、`/period/*`、`/registration/*`、`/winner/*` 端点保持路径兼容，权限归属迁移到对应子模块权限。

### 用户端

- `GET /app-api/activity/period/detail` 和 `latest` 返回 `conditions`，每项包含 `type`、展示名称、说明、是否通过和安全的失败原因（未报名时可为空）。
- `POST /app-api/activity/period/register` 继续只接收期次和可选推荐/渠道信息，不接受用户 ID、租户 ID 或条件结果；服务端以期次快照执行校验。
- 条件失败返回统一报名条件失败语义，并允许客户端依据 `conditions` 展示失败项；不返回企微 UserID、标签 ID 或内部堆栈。

## 条件类型契约

条件类型是后端注册表的稳定字符串标识，条件实例是模板中一次具体配置。元数据至少包含：`type`、`category`、`name`、`description`、`configSchema`、`version`、`enabled`。内置条件由模板复选框选择，扩展条件由模板下拉框添加实例；同一扩展类型可以添加多次。条件配置必须是 JSON object，禁止脚本、表达式和任意类名。

条件处理器的运行上下文由服务端构造，至少包含当前登录用户 ID、租户 ID、期次 ID、请求时间和租户业务时区。需要业务数据的处理器只能调用后端已登记的查询客户端；客户端和管理端不得传入外部 URL、凭据、任意用户 ID 或任意日期范围。

本期内置类型：

- `WECOM_ADMIN_FOLLOWED`：配置 `config.admins`（客户管理员企业微信 UserID 列表）；命中任一管理员关系通过。
- `WECOM_GROUP_MEMBER`：配置 `config.tagIds`（群标签 ID 列表）；命中任一标签下本地群成员通过。

活动模板保存时，后端从模板的 `admins` 和 `groups` 配置分别生成这两个内置条件的 `config.admins`、`config.tagIds`，不以调用方直接提交的条件配置为准；期次快照保存生成后的完整参数。

`HAS_CONFIRMED_ORDER_WITHIN_DAYS`：配置 `config.days`（正整数，条件定义支持多天）；当前管理端暂配置 `days=1`。后端通过受控订单查询客户端调用外部商城的 `do=HasTodayConfirmedOrder` 接口，不传递 `days` 参数；配置其他天数时明确失败，待外部接口支持范围查询后再扩展。

组合规则固定为 AND，条件顺序由 `sort` 决定，但不得改变通过语义。

## Database

- `yshop_activity_template`：新增 `condition_config JSON` 和必要的配置版本字段；旧 Boolean 字段保留兼容期。
- `yshop_activity_period_snapshot`：新增 `condition_snapshot JSON`，保存条件 type、配置、展示信息和处理器版本。
- `yshop_activity_registration`：新增 `condition_result JSON`，保存每项通过状态、时间和安全摘要；旧管理员/群结果字段继续回填。
- 新增租户级 `yshop_activity_condition` 配置表：`tenant_id`、`condition_type`、`description`、审计字段和逻辑删除字段；唯一键为租户 + 条件类型 + deleted。
- 数据迁移将旧 Boolean 条件转换为等价 `condition_config`；无条件模板转换为空数组。迁移必须限定租户/记录范围并提供回滚说明。
- 升级脚本：`backend/sql/upgrade-2026-09-17-activity-management-refactor.sql`。

## 权限与菜单

父菜单：`活动管理`。

子菜单：

- `模板管理`：`activity:template:*`
- `期次管理`：`activity:period:*`
- `报名管理`：`activity:registration:*`
- `中奖管理`：`activity:winner:*`
- `条件管理`：`activity:condition:query`；条件实例 CRUD 权限见活动条件实例管理契约。

本次需把条件管理纳入活动管理树，并将现有隐藏的报名/中奖路由改为独立菜单入口。旧权限码尽量保持不变，通过菜单父子关系迁移减少角色授权回归；新增条件权限默认不自动授予超出原活动范围的角色，迁移脚本需明确默认授权策略。

## 兼容与错误语义

- 旧管理端在过渡期仍可提交两个 Boolean 字段；后端转换后返回新旧字段，避免一次性破坏旧客户端。当前内部条件类型仍使用 `HAS_CONFIRMED_ORDER_WITHIN_DAYS`，条件定义保留 `days` 参数；当前外部接口仅支持 `days=1` 对应的当天查询。
- 未知条件类型、条件停用、配置不合法、处理器版本不兼容：模板保存/期次生成失败。
- 条件执行失败：报名失败，不创建报名记录；用户端只返回统一安全错误和条件结果。
- 外部条件查询超时、限流、认证失败、非 2xx 或响应不完整均按条件执行失败处理；不得降级放行。
- 条件配置缺失或快照损坏：禁止报名并记录可定位日志，不回退读取模板实时配置。
- 所有接口继续执行现有认证、租户隔离和部门/商圈数据权限。

## MQ / 外部系统

本次不新增 MQ topic 或外部系统；企微数据继续通过 `mp-api` 读取本地同步数据。后续接入订单条件时，需新增独立的外部订单查询契约，明确认证来源、请求/响应字段、超时/重试、限流、幂等和数据脱敏；禁止在条件配置中保存外部凭据。
