# 企业微信客户群定时推送 API 合同变更

## 业务语义

- 定时推送是按天重复执行的周期任务；保存时记录企业微信配置、群标签、素材组、可选发送成员和每日执行时间。
- 每日执行时间只选择一个时间点，分钟值必须为 5 的倍数，最小设置粒度为 5 分钟。
- 执行时按任务保存的群标签匹配当前租户、当前企业微信配置下的客户群；多个标签命中任一标签即可。
- 企业微信仍按现有客户群群发接口创建任务，后续由企业微信跟进成员确认发送。
- 定时任务状态：`ENABLED` 已启用、`PROCESSING` 执行中、`SUCCESS` 最近一次执行成功、`FAILED` 最近一次执行失败、`CANCELLED` 已取消。`SUCCESS` 和 `FAILED` 任务仍会在后续日期继续执行。
- 全局 Quartz 任务 `wecomCustomerGroupScheduledPushJob` 每 5 分钟执行一次，并通过多租户 Job 机制逐租户扫描。

## 管理后台接口

### `POST /mp/wecom-customer-group/schedule-create`

创建每日定时推送。

请求体：

```json
{
  "accountId": 1,
  "tagIds": [10, 11],
  "sender": "zhangsan",
  "materialGroupId": 20,
  "dailyTime": "10:00:00"
}
```

约束：`tagIds` 非空；`dailyTime` 必须是合法时间且分钟为 5 的倍数；所有标签和素材组必须属于 `accountId`。

响应：返回创建的任务编号 `Long`。

权限：`mp:wecom-customer-group:schedule-create`。

### `GET /mp/wecom-customer-group/schedule-page`

查询当前租户下的定时推送分页。必填 `accountId`，可选 `status`。

响应字段包括：任务编号、企业微信配置编号、标签编号及名称、发送成员、素材组编号、每日执行时间、最近一次执行状态、企业微信任务 ID、目标群数、失败群 ID、错误信息、开始时间和完成时间。

权限：`mp:wecom-customer-group:schedule-query`。

### `POST /mp/wecom-customer-group/schedule-cancel`

取消当前租户下未处于执行中的每日定时推送。允许取消 `ENABLED`、`SUCCESS`、`FAILED` 状态的任务。

请求参数：`id`。

响应：`true`。

权限：`mp:wecom-customer-group:schedule-cancel`。

## 数据契约

新增表 `mp_wecom_customer_group_schedule`，必须包含 `tenant_id` 及标准审计/逻辑删除字段，并以 `daily_time` 保存每日执行时间。标签编号以 JSON 保存任务创建时的选择，执行时重新读取标签对应的客户群；任务执行结果记录最近一次执行结果，不修改历史素材和客户群快照。

## 兼容性

- 既有即时群发接口行为不变。
- 新增接口和菜单权限不影响现有客户群、标签及素材管理。
