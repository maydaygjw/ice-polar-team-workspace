# printer-shop 审查报告

审查对象：backend（`.worktrees/backend-printer-shop`）+ admin（`.worktrees/admin-printer-shop`），分支 `feat/printer-shop`。
对照 `review-agent.md` 清单逐项核查。租户上下文已验证正确（consumer 经消息头恢复；回调经 ignore-urls 走 `setIgnore` 跨租户按 device_id 查询），不列为问题。

## Critical

无。

## Major

### M1. retryJob 未清空 failureReason / finishedAt（数据正确性）
`PrintShopService.java:220-225`：`reset.setFailureReason(null)` 与 `reset.setFinishedAt(null)` 经 `updateById` 提交，但 MyBatis-Plus 默认 `NOT_NULL` 策略**忽略 null 字段**，仅 `status` 被更新。随后 `submitPrintJobByOrder` 成功分支（`:99-104`）也只设 `status`/`startedAt`，不清这两个字段。结果：重试后任务已回到 QUEUED/PROCESSING，却仍显示上次的失败原因与完成时间，误导后台。
**修复**：用一条 `LambdaUpdateWrapper` 显式 `set(failureReason, null).set(finishedAt, null).set(taskId, null).set(status, CREATED).eq(id, …)`，替代 `updateById(reset)` + 单独清 taskId 的两步。

### M2. 提交打印任务无幂等 CAS，崩溃重投可重复提交（重复扣费风险）
`PrintShopService.java:64-67`（check taskId 为空）与 `:99-104`（updateById 写 taskId）是 check-then-act，非原子。Redis Stream 同组不会并发投递同一条消息，但消费崩溃后重投（pending claim）时，若第一次提交已完成但未 ACK，第二次会再次通过空 taskId 检查并重复提交，链科侧重复计费。
**修复**：提交成功后用条件更新落库 task_id：`UPDATE ... SET task_id=? WHERE id=? AND task_id IS NULL`，按影响行数判断是否本实例获胜；非获胜方直接返回。

### M3. 自动退款失败被静默吞掉（资金风险）
`AppPrintCallbackController.java:73-79` 的 try/catch 捕获全部异常仅 `log.error` 并返回 success；`OrderApiImpl.autoRefundOrder` 先置 `refund_status=1`（已提交）再调 `orderRefund`，若支付通道退款抛异常，异常上抛被 controller 吞掉。终态：设备订单 FAILED、业务订单 `refund_status=1`（退款中）但实际未退款，且无告警/人工入口。同样影响 `submitPrintJobByOrder` 提交失败退款路径（`:95`）与 `retryJob`。
**修复**：`autoRefundOrder` 内捕获退款异常，记录 ERROR 并保留 `refund_status=1`（不回滚到 0），同时落一条"待人工退款"记录或显式返回失败让调用方区分；controller 不应把退款异常当成功。至少要求：退款失败时日志含 orderId + 可观测标记，并在 `PrintJobController` 暴露退款状态供后台核查。

### M4. 后台 taskId 搜索不生效（功能缺失）
前端 `printJob/index.vue` 查询表单含"任务ID"并随 params 发送 `taskId`，但后端 `DeviceOrderPageReqVO` 无 `taskId` 字段、`DeviceOrderMapper.selectPage`（`DeviceOrderMapper.java:17-26`）无对应 `eqIfPresent`，参数被 Spring 忽略。后台按 taskId 搜索静默无效。
**修复**：`DeviceOrderPageReqVO` 增加 `taskId`，`selectPage` 增加 `.eqIfPresent(DeviceOrderDO::getTaskId, reqVO.getTaskId())`。

### M5. retryJob 返回 true 即使重提交内部失败/已退款（误导后台）
`PrintShopService.retryJob`（`:204-232`）调用 `submitPrintJobByOrder`（void，内部捕获异常并 markFailed + autoRefund）后无条件 `return true`。`PrintJobController.retryJob` 据此返回 success，前端提示"已重新提交"。实际可能已失败并触发退款。
**修复**：`retryJob` 重新查询订单状态判断是否真正进入 QUEUED/PROCESSING，据此返回；或 `submitPrintJobByOrder` 改为返回结果枚举供调用方判断。

### M6. submitPrintJobByOrder 无事务，状态与 task_id 落库不一致窗口
`PrintShopService.java:91-104`：`printerGateway.submitJob` 拿到 task_id 后，`updateById` 写 task_id 与 QUEUED。若该 update 失败（DB 抖动），链科侧任务已创建但本地无 task_id，后续回调因 task_id 不匹配被丢弃，任务成孤儿，且无法取消/重试。
**修复**：将"写 task_id"放入事务并加重试；或落库失败时主动调 `cancelJob` 补偿。至少记录 ERROR 供人工对账。

## Minor

### m1. LiankePrinterGateway 以文本表单字段传 jobFile=URL，字段语义待联调验证
`LiankePrinterGateway.java:46`：`addFormDataPart("jobFile", request.getFileUrl())` 把 URL 作为普通文本字段。链科文档"也支持链接地址"未明确是文本字段还是文件 part；Go SDK 用 `file` 字段传文件路径、PHP 用 `jobFile`。字段名与传法需真机联调确认。
**建议**：联调时核对链科实际接受的 `jobFile` 形式（文本 URL + `urlFileExt`），不符则调整。

### m2. deviceKey 明文入库
`DeviceManagementDO.deviceKey`（链科云盒凭证）明文存储于 `yshop_device`。`apiKey` 走 env（正确），但 per-device 的 deviceKey 必须入库，当前无加密。建议字段级加密或至少访问审计。

### m3. callbackBaseUrl 未配置时静默无回调
`LiankePrintProperties.callbackBaseUrl` 为空时 `buildCallbackUrl` 返回 null（`PrintShopService.java:292-296`），提交任务不带 callbackUrl，链科不回调，状态只能靠后台手动查询推进。无启动校验或告警。
**建议**：启动时校验 `apiKey`/`callbackBaseUrl` 非空，否则快速失败并日志告警。

### m4. handleCallback 注释与实现不符
`PrintShopService.java:130` 注释"task_id 匹配本地未终态任务"，但查询未按未终态过滤，实际靠 `isForward` 兜底。功能正确，注释误导。改注释为"匹配本地任务（终态由状态机判定）"。

### m5. CANCELLED 未记 failureReason
`PrintShopService.java:161-163`：仅 FAILED 写 failureReason；CANCELLED（REVOKED）不写。后台取消/被撤销的任务无原因记录。建议 CANCELLED 也记 `task_result.msg` 或"已取消"。

### m6. selectListByUserIdIgnoreDeleted 列名清单已过时
`DeviceOrderMapper.java:30-37` 的原生 `@Select` 显式列出列，未含新增 `task_id`/`page_count`。该方法当前仅制冰机用，但清单与 DO 不一致是隐患。建议改为 `SELECT *` 或补齐新列。

### m7. 退款原因字符串重复构造
`PrintShopService.java:172-173`：`buildFailureReason(payload)` 在 FAILED 分支被调用两次（一次写 DB 已在 `:162`，一次拼退款原因）。提取局部变量复用。

## Nit

### n1. 前端 list 类型与动态属性
`printJob/index.vue`：`list = ref<any[]>)`，`row._querying` 动态挂载。功能可用但失类型安全。可定义带 `_querying?: boolean` 的行类型。

### n2. DeviceOrderPageReqVO 设备类型被前端忽略无害
`PrintJobController` 强制 `setDeviceType(PRINTER)`，前端不传 deviceType，符合预期。无需改。

## 验证缺口

1. **端到端不可运行（已知，out-of-scope）**：无打印设备订单创建路径（谁建 `DeviceOrderDO` deviceType=printer 未实现，属小程序下单链路），且 `fillJobFileAndSpec` 为 TODO（不传 fileUrl/纸张/份数，链科提交必失败）。当前任意真实打印订单都会走"提交失败->自动退款"。test-notes 已记录，本期后端核心闭环已就绪，待小程序下单链路补齐方能端到端。
2. **真机联调未执行**：链科提交/查询/取消的真实 HTTP 字段映射（含 m1）未验证，需配置 `LIANKE_PRINT_API_KEY` 等本地凭证后联调。
3. **LiankePrinterGateway 无单测**：HTTP 字段映射依赖真实响应样例，建议联调时补契约测试。
4. **autoRefundOrder 无集成测试**：涉及支付通道退款，需 mock `manager.refund`，未覆盖。
5. **admin 页无 E2E**：菜单需先执行升级 SQL，未做 Playwright/人工验证。
6. **预存失败项**：全仓 `mvn test` 的 `DesensitizeTest`、admin `pnpm ts:check` 的 type-library 解析错误均为预存环境问题（干净 origin/master 树同样失败），与本功能无关。

## 结论

**pass**（M1-M6 已修复并复跑验证通过）。

核心架构（类型分发、回调三重校验+前进式状态机、MQ 触发、自动退款编排、租户处理）方向正确，编译/6 单测通过、admin 构建通过。

6 个 Major 已全部修复并复跑验证：
- M1（retry 清字段）：单条 `LambdaUpdateWrapper` 显式置空。
- M2（提交幂等）：Redisson 锁 `printer:submit:{orderNo}` + 锁内二次检查。
- M3（退款失败静默）：`autoRefundOrder` 返回 boolean，失败保留 refund_status=1 并 ERROR 告警。
- M4（taskId 搜索）：ReqVO+Mapper 补 taskId。
- M5（retry 返回值）：重查后按实际状态返回。
- M6（落库一致性）：落库失败 `cancelJob` 补偿。
附带修复 Minor m5/m6/m7。修复后 `PrintShopServiceTest` 6/6 复跑通过，编译 BUILD SUCCESS。

剩余为已知 out-of-scope 项，不阻塞本期交付：端到端联调与小程序下单链路（谁建 printer 设备订单、`fillJobFileAndSpec` 填充）属后续 feature；真机联调待配置 `LIANKE_PRINT_API_KEY` 后进行。Minor m1（jobFile 字段形式）/m2（deviceKey 明文）/m3（callbackBaseUrl 启动校验）建议联调期处理，不阻塞。
