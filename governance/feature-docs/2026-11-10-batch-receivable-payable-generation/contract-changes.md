# 按日期和店铺批量生成应收应付契约

## 接口

| 方法与路径 | 权限 | 说明 |
|---|---|---|
| `POST /admin-api/pay/receivable-payable/generation-tasks` | `pay:receivable-payable:generate` | 创建异步生成任务。 |
| `GET /admin-api/pay/receivable-payable/generation-tasks/{id}` | `pay:receivable-payable:generate` | 读取当前用户在当前租户创建的任务进度。 |
| `POST /admin-api/pay/receivable-payable/generation-tasks/{id}/cancel` | `pay:receivable-payable:generate` | 请求中断当前用户在当前租户创建的任务。 |
| `POST /admin-api/pay/receivable-payable/sync-settlement-status/tasks/{id}/cancel` | `order:settlement:query` | 请求中断当前用户在当前租户创建的分账状态同步任务。 |

创建请求为 `{ "payDate": "YYYY-MM-DD", "shopIds": [1, ...], "regenerate": false }`。`regenerate` 可省略，默认 `false`。`shopIds` 必填且去重后最多 1000 个，服务端校验门店属于当前租户；日期是单个支付日期。响应返回 `taskId`。

## 处理规则

- 只查询当前租户本地店铺订单，要求订单状态为待评价（2）或已完成（3）、已支付、退款状态为未退款（0）或退款已拒绝（3）、支付日期为所选日期、店铺 ID 在请求范围内。`regenerate=false` 时只包含订单表 `receivable_payable_generated=false` 的订单；`regenerate=true` 时也包含已生成订单并按当前计费模板重算。
- 已存在不可重算的进行中或成功分账记录时，沿用计费服务的既有保护规则，不覆盖其应收应付快照。
- 候选订单按订单主键游标分页，复用现有应收应付计算与幂等逻辑逐笔处理。并发重复任务由订单计算幂等机制保护；单笔失败不阻断后续订单。
- 任务状态：`PENDING`、`RUNNING`、`CANCEL_REQUESTED`、`SUCCESS`、`COMPLETED_WITH_ERRORS`、`FAILED`、`CANCELLED`。进度字段含订单总数、已处理数、成功数、跳过数、失败数及百分比。任务执行期间逐笔持久化进度；终态后记录结束时间和错误摘要。中断为协作式停止，在当前订单处理完成后生效；已处理结果保留，未处理订单停止执行。
- 一个租户同一时刻最多运行一个生成任务。任务只允许其创建用户在当前租户读取；不得接受客户端租户 ID 或用户 ID。
- 管理端在任务运行期间锁定生成表单和其余页面交互，展示已处理/总数、成功/跳过/失败数量及进度条。页面刷新后恢复轮询当前用户的未完成任务。
- 店铺模块内部查询 API 提供按当前租户批量校验店铺 ID 的能力；应收应付任务创建时拒绝任何不属于当前租户的店铺 ID。订单模块 `OrderApi` 候选查询接收是否包含已生成订单的参数，Pay 模块不直接查询订单表。

## 存储

新增租户隔离的应收应付生成任务表，含任务创建用户、支付日期、门店 ID 快照、状态、进度计数、错误摘要和审计字段；不修改应收应付历史快照。
