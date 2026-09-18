# 活动报名条件实例管理契约变更

## API

统一管理端前缀为 `/admin-api/activity/condition`。

### 条件类型元数据

- `GET /types`
  - 保持现有接口语义：返回后端注册的类型、类别、名称、默认/租户说明、版本、启用状态和 `configSchema`。
  - 不提供类型新增、删除、修改接口。

### 条件实例

- `GET /instance/page`
  - 查询当前租户条件实例分页。
  - 请求：`pageNo`、`pageSize`、可选 `conditionType`、`enabled`、`keyword`。
  - 响应字段：`id`、`conditionType`、`conditionTypeName`、`category`、`name`、`description`、`config`、`sort`、`enabled`、`referenceCount`、`typeAvailable`、`version`、审计时间。

- `POST /instance/create`
  - 请求：`conditionType`、`name`、`description`、`config`、`sort`、`enabled`。
  - 后端生成实例 ID，验证类型和参数；返回实例 ID。

- `PUT /instance/update`
  - 请求：`id`、`name`、`description`、`config`、`sort`、`enabled`。
  - `conditionType` 不可修改；后端按当前租户校验实例归属。

- `DELETE /instance/delete?id={id}`
  - 当前租户未被活动模板引用时逻辑删除。
  - 被引用返回 `CONDITION_INSTANCE_IN_USE`，不删除。

- `PUT /instance/update-status`
  - 请求：`id`、`enabled`。
  - 已被模板引用的实例允许停用，但模板保存和新期次生成时不得继续使用停用实例；管理端需显示引用状态。

### 模板条件引用

模板创建、更新和详情/分页响应中的 `conditions` 调整为条件实例引用项：

```json
{
  "conditionId": 101,
  "sort": 10,
  "enabled": true
}
```

模板详情可同时返回实例展示信息，供管理端回显：`conditionId`、`conditionType`、`name`、`description`、`config`、`enabled`、`typeAvailable`。同一模板不得重复引用同一 `conditionId`。

### 错误语义

- `CONDITION_INSTANCE_NOT_EXISTS`：实例不存在、已删除或不属于当前租户。
- `CONDITION_INSTANCE_IN_USE`：实例仍被当前租户活动模板引用。
- `CONDITION_INSTANCE_TYPE_INVALID`：类型未注册、已停用或处理器不可用。
- `CONDITION_INSTANCE_CONFIG_INVALID`：配置缺失、字段类型错误或处理器参数校验失败。
- `CONDITION_INSTANCE_DUPLICATE_NAME`：同一租户实例名称重复。
- `TEMPLATE_CONDITION_DUPLICATE`：模板重复引用同一实例。
- `TEMPLATE_CONDITION_DISABLED`：模板引用了停用实例。

## Database

新增 `yshop_activity_condition_instance`：

| 字段 | 类型 | 规则 |
|---|---|---|
| `id` | bigint | 主键，自增 |
| `tenant_id` | bigint | 非空，租户隔离 |
| `condition_type` | varchar(64) | 非空，后端注册类型 |
| `name` | varchar(128) | 非空，同租户逻辑唯一 |
| `description` | varchar(500) | 非空 |
| `config` | JSON | 非空 JSON object |
| `sort` | int | 非空，默认 0 |
| `enabled` | bit(1) | 非空，默认 true |
| 审计字段 | BaseDO | creator/create/update/deleted |

索引：

- `uk_tenant_name_deleted (tenant_id, name, deleted)`
- `idx_tenant_type_enabled_deleted (tenant_id, condition_type, enabled, deleted)`

模板 JSON 条件项从直接保存 `type/config` 改为保存 `conditionId` 引用；期次快照继续保存完整执行快照。

迁移脚本沿用活动管理特性脚本日期，新增到 `backend/sql/upgrade-2026-09-17-activity-management-refactor.sql`，包含建表和必要的回滚注释。已有模板条件不能自动推断为实例名称，迁移策略需在实现前确定：默认只迁移可明确映射的条件，无法映射的数据由管理端重新配置。

## 权限与数据范围

新增权限：

- `activity:condition:instance:query`
- `activity:condition:instance:create`
- `activity:condition:instance:update`
- `activity:condition:instance:delete`

沿用活动管理父菜单和当前租户隔离；条件实例不增加部门/商圈数据范围，引用扫描只查询当前租户的活动模板。条件类型元数据查询继续使用 `activity:condition:query`。

## MQ / 依赖 / 外部系统

N/A：不新增 MQ、Maven/npm 依赖或外部系统。外部订单仍通过现有 `WxappOrderClient`，请求和响应报文继续以 DEBUG 记录并脱敏。

## 兼容与删除策略

- 不兼容旧的直接按条件类型选择扩展条件的管理端交互，管理端改为选择条件实例。
- 历史期次快照和报名结果不回写、不重算，也不参与实例删除阻断。
- 业务表使用逻辑删除，保留审计记录；被模板引用时拒绝删除。
