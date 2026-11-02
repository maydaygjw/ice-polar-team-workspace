# 第三方支付 OpenAPI 功能契约

## API

### 认证与令牌

| 方法与路径 | 权限 | 请求 | 响应/语义 |
|---|---|---|---|
| `POST /open-api/oauth2/token` | OAuth2 HTTP Basic | `grant_type=client_credentials`、必填 `scope`（空格分隔） | Bearer token、`expires_in`、最终授予 `scope`；只签发客户端身份 token，不返回 refresh token。 |

现有 `POST /admin-api/system/oauth2/token` 保持现状和兼容性。OpenAPI token 入口只接受 `client_credentials`。客户端必须存在有效 OpenAPI 租户绑定；申请范围必须是管理员在 admin 分配的 scope 子集。

### 支付

| 方法与路径 | Scope | 说明 |
|---|---|---|
| `POST /open-api/v1/payments` | `payment:create` | 创建微信 JSAPI 支付单。要求 `Idempotency-Key`。 |
| `GET /open-api/v1/payments/{paymentId}` | `payment:read` | 查询当前客户端的支付单及退款状态。 |
| `GET /open-api/v1/payments/by-client-order/{clientOrderNo}` | `payment:read` | 按第三方业务订单号查询。 |
| `POST /open-api/v1/payments/{paymentId}/refund` | `payment:refund` | 申请全额原路退款；要求 `Idempotency-Key`。 |

### 支付创建 DTO

请求 JSON：

```json
{
  "clientOrderNo": "第三方业务订单号",
  "amount": 12800,
  "currency": "CNY",
  "subject": "订单标题",
  "payerOpenId": "微信用户 OpenID"
}
```

- `amount` 是人民币分的正整数；只接受 `CNY`。进入现有支付 SDK 前按分精确转换为两位小数，不经过浮点数。
- `clientOrderNo` 在同一 OAuth 客户端内唯一。
- `payerOpenId` 属于该客户端绑定租户使用的 JSAPI AppID；不接受 `tenantId`、商户密钥、商户号、支付配置 ID 或请求级 notify URL。
- JSAPI AppID 从 admin 预先绑定到客户端的微信小程序或公众号支付配置中取得；请求体不允许选择 AppID。
- 相同客户端、订单号、幂等键、金额、币种和标题重试，返回同一支付单；同订单号或幂等键对应的关键内容不一致返回 `409`。

创建响应至少包括 `paymentId`、`clientOrderNo`、`amount`、`currency`、`status`、`expireTime`、`appId` 和 `paymentData`。`paymentData` 包含微信 JSAPI 调起字段 `timeStamp`、`nonceStr`、`package`、`signType`、`paySign`。第三方服务端将这些字段传给自身微信客户端；平台不提供收银页面。

### 查询 DTO

支付状态为 `PENDING`、`SUCCESS`、`FAILED`、`CLOSED`；退款状态为 `NOT_REFUNDED`、`PROCESSING`、`SUCCESS`、`FAILED`。支付查询返回平台支付单号、第三方订单号、金额/币种、两组状态、微信交易单号（支付成功后可用）及创建/支付/退款时间。只有本客户端记录可见；跨客户端访问按 `404` 隐藏存在性。

### 退款 DTO

JSON 请求只接收 `reason`（可选）；退款幂等键通过 `Idempotency-Key` 请求头传入，不接受退款金额。退款金额固定为支付单全额。相同幂等键重试返回已有退款结果；处理中或已成功退款的支付单不重复向微信创建退款。响应区分 `PROCESSING`、`SUCCESS` 或明确拒绝原因。

### Webhook

- 接收地址由 admin 在客户端配置中维护；只接受 HTTPS，禁止创建支付请求动态覆盖地址。
- 事件类型：`payment.succeeded`、`payment.failed`、`payment.closed`、`payment.refunded`。
- JSON 载荷至少含 `eventId`、`eventType`、`paymentId`、`clientOrderNo`、`status`、`amount`、`currency`、`occurredAt`。
- 以客户端独立密钥对 `timestamp + "\n" + rawBody` 执行 HMAC-SHA256；签名头提供时间戳、算法和签名。接收端使用 `eventId` 去重并在成功处理后返回 2xx。
- 平台至少一次投递；首次状态变化后立即发送，HTTP 超时为 5 秒，未收到 2xx 时最多投递 8 次，重试间隔依次为 1 分钟、5 分钟、30 分钟、2 小时、6 小时、12 小时和 24 小时。耗尽后记录为失败，管理员可在客户端详情页重放同一事件（保持相同 `eventId` 和载荷）。
- 密钥轮换由管理员和第三方接收方协调：接收方先部署新旧密钥并行验签，再切换平台密钥；轮换后新投递和重放均使用当前密钥。

### 错误语义

| HTTP 状态 | 语义 |
|---|---|
| `400` | 参数格式/金额/币种无效，或请求不支持。 |
| `401` | Bearer token 缺失、无效、过期或撤销。 |
| `403` | 客户端被停用、绑定失效或 token 缺少 endpoint 所需 scope。 |
| `404` | 支付单不存在或不属于当前客户端。 |
| `409` | 外部订单/幂等键与已存在请求内容冲突，或订单状态不允许执行退款。 |
| `429` | 客户端或租户超过限流阈值。 |
| `5xx` | 平台或微信支付临时故障；调用方只应以相同幂等键重试。 |

错误响应沿用平台 `CommonResult` 字段格式，需包含稳定错误码和不泄露渠道密钥/配置细节的说明。

## DB

- 新增 `system_open_api_client_config`：`client_id` 唯一、租户 ID、微信 JSAPI `payment_details_id`、启用状态、预设 Webhook 地址、加密通知密钥及标准审计字段。
- 新增 `pay_open_api_order`：第三方订单与平台/微信支付单关联、创建幂等键及请求摘要、金额币种、状态、退款幂等键及退款快照；唯一键 `(tenant_id, client_id, client_order_no)`、`(tenant_id, client_id, create_idempotency_key)` 和 `(tenant_id, payment_id)`。
- 新增 `pay_open_api_webhook_event`：唯一事件 ID、事件载荷、尝试次数、状态、下次重试时间和最后错误摘要。
- 复用 `system_oauth2_client.scopes` 保存客户端已授予 scope；scope 目录代码固定并由 admin 展示，不新增任意 scope CRUD。
- 采用一份 Flyway 迁移，放入 `backend/sql/migrations/V<next>__third_party_payment_openapi.sql`。部署前按目录最高版本确定实际版本号。不得修改基线 SQL。
- 回滚仅能在新表无业务记录时删除表；进入生产后应优先回滚应用、保留支付/回调/审计数据。

## 权限与数据范围

- 固定 scope：`payment:create`、`payment:read`、`payment:refund`，对应创建、查询、全额退款；不得映射到后台菜单权限。
- OAuth client 仍用 `system_oauth2_client.scopes` 保存获授集合；scope 由后台受控选择，不允许任意文本输入。
- token 中的主体类型为 CLIENT，租户 ID 由 `system_open_api_client_config` 绑定并在 token 中固化；OpenAPI handler 重新核对客户端及绑定启用状态，避免只依赖 scope。
- 新订单、退款、查单均要求同时匹配 token tenant、client ID 与订单关联记录；不得仅凭全局支付 ID 查询。
- 停用客户端或绑定后立即拒绝支付创建、退款和查询；支付渠道回调及后台对账仍处理已受理单据，Webhook 依据存量订单绑定投递策略继续执行。
- admin scope 修改不修改后台用户菜单角色。客户端 scope 移除后既有 token 最长在令牌有效期内生效；客户端禁用/绑定禁用即时拒绝。

## MQ 与回调

- 微信渠道回调继续使用现有 `WxPayMessageHandler` 完成验签/解密，并沿用 `order.pay.notice` 支付结果消息。
- `bizType=open_api` 的记录由 pay 模块 OpenAPI 专用消费组处理；更新状态幂等，不进入 mall 订单履约消费者。
- 支付/退款状态转移与 Webhook outbox 入库保持原子；HTTP 投递由后台任务处理，不在渠道回调线程调用外部系统。
- 超时/网络失败/非 2xx 采用有限退避重试；对同一状态重复回调不重复创建事件。超限后告警并保留可人工安全重放的投递记录。

## 兼容性

- `/admin-api/system/oauth2/token`、既有 OAuth 客户端 scopes、`/app-api` 会员 API 和已有微信支付回调 URL 均保持兼容。
- OpenAPI 新增独立 `/open-api` 前缀；旧治理文档中“开放接口复用 `/app-api`”规则由本功能修订，已有 C 端路径不迁移。
- 新支付记录使用 `bizType=open_api`，不写商城订单表、不触发订单状态机或履约流程。
- 机器 OpenAPI JSON 快照在实现接口稳定后更新 `governance/CONTRACT/`。

## 未冻结项

- 每客户端/租户的限流额度、支付单有效期，以及微信 API 具体故障码到稳定 OpenAPI 错误码的映射，在实现前由 Architecture Agent 根据部署容量和微信接口行为定值。
