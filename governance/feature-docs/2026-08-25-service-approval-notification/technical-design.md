# 技术设计：服务订单审批通过短信通知

## 模块影响

| 模块 | 影响 |
|---|---|
| `yshop-module-site-biz` | 修改服务订单审批服务；在审批成功提交后编排短信通知；增加并发安全更新和单元测试。 |
| `yshop-module-system-api` | 扩展租户查询 API，提供按租户 ID 获取租户名称的跨模块能力；复用现有 `SmsSendApi`。 |
| `yshop-module-system-biz` | 实现新增租户名称 API 方法；短信发送实现无需新增能力。 |
| 数据库 | N/A，不新增表、字段或迁移脚本；复用 `system_sms_log`。 |
| `admin` / `miniapp` / `icepolar-dms` | N/A。 |

## 关键决策

### 1. 复用现有短信 API 和 MQ

`site-biz` 通过已存在的 `yshop-module-system-api` 调用 `SmsSendApi.sendSingleSmsToMember`，传入会员用户 ID、模板编码和两个模板参数。系统短信服务负责模板校验、短信日志落库和 MQ 投递，业务模块不直接依赖阿里云/腾讯云 SDK，也不拼接短信正文。

### 2. 事务提交后发送

审批方法继续保持事务边界。数据库状态更新成功后，通过现有 `TransactionSynchronizationManager` 注册 `afterCommit` 回调；只有事务真正提交才调用短信 API，避免审批回滚后仍通知用户。回调内捕获异常并记录业务日志，不能反向影响已提交的审批结果。

现有短信 API 本身通过短信 MQ 异步投递供应商，因此本功能不新增 MQ topic、消息体或补偿表。

### 3. 通过 `TenantApi` 获取租户名称

当前 `TenantApi` 只有租户 ID 列表和合法性校验，`site-biz` 不能直接依赖 `system-biz` 的 `TenantService`。扩展 `TenantApi` 增加 `getTenantName(Long tenantId)`，由 `system-biz` 实现并返回租户名称；站点模块只依赖 API 层，保持跨模块依赖方向。

### 4. 原子化审批更新，保证通知幂等边界

当前审批逻辑先读取待审核状态，再按 ID 更新，存在并发请求同时通过的窗口。实现时增加 Mapper 原子更新：`id = ? AND audit_status = PENDING`，同时更新审核状态和备注，并检查影响行数。影响行数为 0 时抛出现有“已审核不能重复操作”错误；只有影响行数为 1 的请求注册短信回调。

这不改变状态枚举语义，也不增加数据库结构；租户隔离继续由现有 MyBatis 多租户机制和订单查询边界保证。

## 处理流程

```text
后台审批接口
  → site-biz 查询服务订单并校验 PENDING
  → 查询订单用户 ID、预约时间、租户 ID
  → 原子更新 PENDING → APPROVED
  → 注册事务 afterCommit 回调
  → TenantApi 获取租户名称
  → SmsSendApi.sendSingleSmsToMember(
       templateCode=service_approval_notification,
       templateParams={time, tenant}
     )
  → system_sms_log 落库
  → 现有短信 MQ
  → 短信供应商
```

### 发送请求语义

```json
{
  "userId": 1001,
  "templateCode": "service_approval_notification",
  "templateParams": {
    "time": "2026-08-26 14:00",
    "tenant": "某某家政"
  }
}
```

发送给 Member 时优先传 `userId`，不在 site 模块复制手机号查询逻辑；现有短信服务负责加载手机号并执行模板、渠道和手机号校验。

## 异常与日志

- 审批校验、原子更新和事务异常：沿用现有错误码和事务回滚规则，不触发短信。
- `afterCommit` 内的租户查询、模板校验、手机号校验、MQ 投递异常：只记录失败，不能修改审批结果。
- 业务日志至少包含 `orderId`、`tenantId`、`userId`、`templateCode` 和异常分类；不记录短信密钥、API Secret、access token 或完整手机号。
- 短信供应商的成功/失败、API 错误码和请求 ID 继续由现有 `system_sms_log` 记录。

## 幂等与一致性

- 同一待审核阶段只允许一个原子更新成功，因此同一审批转换只注册一次短信。
- 拒绝后重新提交会把状态重新置为待审核，下一次通过形成新的转换并允许再次发送。
- 本期不增加业务通知幂等表；短信日志编号由现有短信服务生成。
- 如果进程在事务提交后、短信回调执行前崩溃，审批结果已保存但本次通知可能丢失。该风险通过现有短信日志能力无法完全消除；若未来要求可恢复投递，应另行引入事务消息/通知 Outbox，不在本期范围内。

## 风险

- 系统短信模板管理使用 `{time}`、`{tenant}` 解析参数，而需求描述使用 `${time}`、`${tenant}`。上线前必须确认系统模板内容与短信平台审核模板的占位符映射，避免模板参数数组为空或参数名不匹配。
- 租户名称 API 是本次跨模块契约增量，必须同步更新 system-api 与 system-biz 的实现和测试。
- `afterCommit` 回调是进程内触发，不提供崩溃恢复；本期接受该风险，审批结果不因短信可用性受影响。
