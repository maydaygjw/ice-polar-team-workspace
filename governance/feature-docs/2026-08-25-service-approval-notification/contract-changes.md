# 契约变更：服务订单审批通过短信通知

## API

### 内部模块 API

扩展 `co.yixiang.yshop.module.system.api.tenant.TenantApi`：

```java
String getTenantName(Long tenantId);
```

语义：按租户 ID 返回租户展示名称；租户不存在时返回 `null`，由调用方在审批后通知链路中记录并跳过本次短信，不影响已提交审批。

复用现有 `SmsSendApi`，不新增短信发送 API：

```text
sendSingleSmsToMember(
  userId = order.uid,
  templateCode = service_approval_notification,
  templateParams = {time, tenant}
)
```

### 对外 HTTP API

N/A。现有后台服务订单审批接口路径、请求字段、响应结构和权限不变。

## DB

N/A。无需新增表、字段、索引或升级脚本。复用：

- `yshop_site_order.audit_status`：已有审批状态字段。
- `system_sms_log`：已有短信发送日志。

审批 Mapper 增加带 `audit_status = 0` 条件的原子更新语义，不改变 schema。

## MQ

N/A（不新增消息契约）。继续复用系统短信模块现有短信 MQ；消息由 `SmsSendService` 根据 `service_approval_notification` 的系统模板配置生成。

## 权限与数据范围

- 审批权限沿用现有服务订单审核后台权限。
- 短信调用是后端模块间调用，不新增前端权限码。
- 订单、服务订单和租户名称均按当前订单所属租户处理，不允许使用请求参数中的任意租户 ID 覆盖归属。
- 短信发送给订单 `uid` 对应的 Member 用户，不向管理员、服务人员或租户联系人发送。

## 外部系统与配置

短信平台和系统短信模板管理必须预先配置：

| 配置项 | 值 |
|---|---|
| 系统模板编码 | `service_approval_notification` |
| 业务内容 | `您的订单已审核通过，预约服务时间：${time}。请及时进入“${tenant}”小程序完成支付。` |
| 参数 | `time`、`tenant` |
| 实际系统模板占位符 | `{time}`、`{tenant}` |
| 渠道/API 模板 ID/密钥 | 各环境配置，不进入代码和仓库 |

系统模板配置应与短信平台审核通过的模板参数顺序和名称一致。模板不存在、禁用或渠道不可用时只记录失败，不回滚审批。

## 机器契约

N/A。本期无公开 HTTP API、跨仓库 API 或新增 MQ schema；实现完成后不需要更新 `governance/CONTRACT/backend-api.json`。内部 `TenantApi` 变更需通过后端编译和单元测试验证。

## ADR

N/A。事务提交后复用现有短信 MQ、跨模块依赖通过已有 system-api、无新增持久化结构，属于现有架构模式内的增量实现。
