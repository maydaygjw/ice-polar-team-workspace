# 第三方支付 OpenAPI 技术设计

## 1. 设计目标

为第三方服务端提供独立的 OAuth2 client-credentials OpenAPI，首期覆盖微信 JSAPI 支付创建、支付查询、全额退款和支付结果 Webhook。复用现有 OAuth2 客户端/令牌能力、微信商户配置、支付 SDK、渠道通知验签和支付记录能力；不让第三方接触微信支付商户密钥，不改变会员端 `/app-api` 的身份和支付流程。

## 2. 模块影响

| 模块 | 变化 |
|---|---|
| `system` 后端 | 新增 OpenAPI 客户端绑定配置和 scope 列表能力；增加仅支持 `client_credentials` 的 OpenAPI token 入口；为 token 绑定正确租户上下文。 |
| `pay` 后端 | 新增 OpenAPI 支付订单编排、查询、全额退款、渠道成功通知处理及 Webhook 投递；继续复用当前租户的微信支付配置和 SDK。 |
| `admin` | 在 OAuth2 客户端配置中设置所属租户、OpenAPI scope、Webhook 地址及通知密钥；提供受控 scope 选项。 |
| `governance` | 独立 OpenAPI 前缀和功能契约记录；机器 API 快照待实现后生成。 |

不修改 `miniapp`、H5 或 DMS。第三方自身客户端仍负责把服务端返回的 JSAPI 参数交给微信客户端调起支付。

## 3. 关键决策

### 3.1 独立接口与 OAuth 身份

- 资源接口使用 `/open-api/v1/**`，令牌接口使用 `POST /open-api/oauth2/token`。现有 `/admin-api/system/oauth2/token` 保持兼容，不改变现有 OAuth 客户端用途。
- 新 token 入口只允许 `client_credentials`，使用 HTTP Basic 客户端认证；不支持 password、authorization_code、refresh token。
- token 主体仍为 `UserTypeEnum.CLIENT`，每个业务请求除检查 scope 外，必须检查主体类型、客户端启用状态及 OpenAPI 绑定状态。
- 现有 `OAuth2ClientDO`/`system_oauth2_client` 没有租户归属字段；不能直接把令牌签发时的后台 `TenantContextHolder` 当作业务租户。新增 `system_open_api_client_config` 以 `client_id` 唯一关联租户。OpenAPI token 的 `tenantId` 从该绑定读取并写入令牌；后续请求由令牌恢复租户上下文。
- 访问令牌申请时，客户端请求的 scope 必须是“该 OAuth2 客户端已授权 scope”与“OpenAPI 客户端绑定已启用 scope”两者的交集；空 scope 请求默认拒绝，避免意外发放无预期权限的令牌。取消授权后，已签发令牌至多在其有效期内继续使用；客户端停用即时拒绝，降低存量令牌等待到期的风险。

### 3.2 Scope 管理

- 使用现有 OAuth2 客户端的 `scopes` 列表保存已授予范围，不新增一份重复授权关系。
- OpenAPI 支持的 scope 为后端定义的固定操作目录：`payment:create`、`payment:read`、`payment:refund`。admin 从后端 scope 目录读取选项并为客户端分配，不允许输入任意 scope 或菜单权限字符串。
- admin 的客户端编辑表单保留现有 OAuth2 通用配置字段；OpenAPI 客户端附加显示租户绑定、OpenAPI scope 与 Webhook 配置。非 OpenAPI 客户端原有 scope 行为保持兼容。
- 管理员只能授予已实现的操作范围；scope 标识不可在 admin 改名。首期不做动态创建新 scope 的能力，新增支付操作必须先经代码和契约评审。

### 3.3 支付单归属和复用支付网关

- 新增 `pay_open_api_order`，作为第三方订单号、客户端、平台支付单和支付/退款状态之间的业务关联；不把外部订单伪装成商城订单，也不触发商城履约。
- 唯一约束为 `(tenant_id, client_id, client_order_no)`、`(tenant_id, client_id, create_idempotency_key)`；平台支付单号另有租户内唯一约束。记录保存关键请求摘要。创建时在事务/锁保护下检查订单号和幂等键，防止并发重复创建。
- OpenAPI 支付编排留在 `pay` 模块，使用 OpenAPI 客户端绑定的租户微信 JSAPI 商户配置（小程序或公众号）和微信支付 SDK 创建预支付单。`payerOpenId` 只用于创建预支付单，不作为订单归属凭证；禁止记录到普通日志，除非渠道排障确需且须脱敏。
- 不复用当前 `PayOrderApi.createPayOrder` 的会员 ID 假设：该 API 的 JSAPI 路径通过 `MemberUserApi` 从会员读取 OpenID。OpenAPI 接收调用方提供的 JSAPI `payerOpenId`，并用独立编排服务将其传给现有支付网关。退款与查单按平台支付单关联的 `outPayNo` 操作，不接受请求方指定渠道商户配置。
- 微信回调仍由现有 `WxPayMessageHandler` 完成验签/解密。支付记录以 `bizType=open_api` 区分；支付通知流新增 OpenAPI 专用消费组，更新 `pay_out_order_no` 和 `pay_open_api_order`，不调用商城订单支付/履约逻辑。
- 支付状态采用 OpenAPI 稳定枚举：`PENDING`、`SUCCESS`、`FAILED`、`CLOSED`；退款状态独立为 `NOT_REFUNDED`、`PROCESSING`、`SUCCESS`、`FAILED`。渠道原始状态仅作为内部映射依据。

### 3.4 Webhook 可靠投递

- 支付状态事务内写入 `pay_open_api_webhook_event` 投递记录；后台任务从待投递记录发送至该客户端预设地址，避免在微信回调请求线程内同步调用第三方。
- 每条事件有稳定唯一 `eventId`，请求体带事件类型、支付/外部订单标识、金额/币种、终态与发生时间。请求以时间戳和原始请求体使用客户端独立 HMAC-SHA256 密钥签名。
- 接收方返回 2xx 即确认。首次状态变化后立即发送，HTTP 超时 5 秒；超时、网络错误和非 2xx 最多投递 8 次，重试间隔为 1 分钟、5 分钟、30 分钟、2 小时、6 小时、12 小时和 24 小时。超过上限后保留失败状态，管理员可重放原事件；不反复阻塞支付回调。投递为至少一次，接收方按 `eventId` 幂等处理。
- Webhook secret 仅创建/轮换时显示，服务端加密保存；读取配置时返回已设置标记，不返回密钥原文。Webhook 地址只允许 HTTPS，禁止内网、环回和链路本地目标；实现需采用解析后地址校验和重定向禁用，降低 SSRF 风险。

## 4. 数据模型增量

具体字段长度遵循现有迁移和数据库规范；以下描述业务字段，不是最终 DDL。

### `system_open_api_client_config`

- `client_id`：OAuth2 客户端编号，唯一关联 `system_oauth2_client`。
- `tenant_id`：业务租户 ID；OpenAPI 请求的唯一租户来源。
- `payment_details_id`：该租户已启用的微信 JSAPI 商户配置标识，只允许小程序或公众号 JSAPI 配置。
- `enabled`：OpenAPI 绑定开关。
- `notify_url`：可空的支付结果 Webhook 地址。
- `notify_secret`：加密保存的签名密钥；不得返回明文或进入日志。
- 标准审计字段及逻辑删除字段。

该配置表不重复保存 scope；客户端授权继续由现有 OAuth2 client scopes 列表承载。客户端绑定和租户不得由业务请求修改。

### `pay_open_api_order`

- 租户 ID、客户端 ID、外部业务订单号、平台支付单 ID、微信外部支付单号。
- 金额（人民币分）、币种、标题、绑定的微信 `payment_details_id`/JSAPI AppID、支付状态、微信交易单号、支付创建/支付完成/过期时间。
- 创建幂等键及请求摘要；退款状态、唯一退款幂等键、退款单号、退款原因及退款完成时间。
- `payerOpenId` 不持久化；如渠道查单要求回传用户标识，应由微信侧数据满足，避免额外保存个人标识。
- 唯一约束：`(tenant_id, client_id, client_order_no)`；唯一约束：`(tenant_id, payment_id)`；查询索引覆盖 `tenant_id + client_id + payment_id`。

### `pay_open_api_webhook_event`

- `event_id` 唯一键、租户 ID、客户端 ID、支付单 ID、事件类型、序列化通知载荷、投递状态、尝试次数、下次投递时间、最后 HTTP 状态/错误摘要和审计时间。
- 索引待投递状态与下次投递时间；错误摘要不得包含签名密钥、访问令牌或完整支付凭据。

迁移放在 `backend/sql/migrations/`，禁止改动基线 SQL。回滚仅在未产生业务记录时删除新增对象；上线后回滚应用时保留三张业务/配置表，避免丢失支付和通知审计数据。

## 5. 关键流程

### 获取 token

1. 第三方向 `/open-api/oauth2/token` 以 Basic 认证提交 `grant_type=client_credentials` 及所需 scope。
2. 系统校验 OAuth 客户端启用、授权类型正确、secret 匹配、请求 scope 属于客户端已授权集合，并校验 OpenAPI 绑定启用。
3. 系统把绑定租户写入 client access token，返回 Bearer token、有效期和最终授予 scope；不签发 refresh token。

### 创建支付单

1. 验证 CLIENT 主体、客户端绑定、`payment:create` scope、HTTPS 入口、金额（正整数分）、CNY 和 JSAPI OpenID；OpenID 使用绑定的 `payment_details_id` 对应 AppID。
2. 以 `(tenant, client, clientOrderNo)` 锁定或唯一约束竞争；同订单同内容返回原支付单，同订单不同金额/币种/标题返回冲突。请求超时但渠道处理结果未知时，复用原平台支付单号查单，不另建可扣款支付单。
3. 创建平台支付关联记录及微信 JSAPI 预支付单。服务端用客户端绑定的微信配置，不接收商户号、渠道配置 ID、notify URL 或支付密钥。
4. 返回 `paymentId`、订单号、金额、状态、过期时间、`appId`、`timeStamp`、`nonceStr`、`package`、`signType`、`paySign`。第三方服务端把 JSAPI 参数传给其微信内 H5/小程序客户端，由客户端完成 `wx.requestPayment`。

### 支付终态和查询

1. 微信支付回调经既有 SDK 验签/解密后产生现有支付通知消息。
2. OpenAPI 专用消费者根据 `bizType=open_api` 幂等更新支付映射和 API 支付单状态；以支付单状态转移成功作为唯一事件创建条件。
3. 同事务新增 Webhook outbox 事件。客户端可用支付 ID 或其订单号查询；平台查单作为通知补偿，浏览器/客户端成功页不改变支付状态。

### 全额退款

1. 校验 `payment:refund`、支付单归属、支付成功、尚无成功/处理中退款。
2. 服务端以支付金额作为退款金额，并使用固定全额退款幂等标识发起原路微信退款；请求不可提交部分金额。
3. 同一退款幂等键同内容返回原结果，不同内容冲突；微信处理中与退款成功分别映射为 `PROCESSING`、`SUCCESS`。
4. 退款状态变更写入 Webhook outbox，第三方也可查询支付单上的 refundStatus。

## 6. 风险与权衡

- **租户绑定错误**：OAuth2 客户端目前无租户归属，新增绑定表和 token tenant claim 是跨租户隔离的前置条件；绑定变更应审计，并在修改后撤销旧 token 或使其绑定版本失效。
- **开放 JSAPI OpenID**：第三方提供的 OpenID 需与管理员给客户端选择的微信小程序或公众号 AppID 对应；微信预下单校验最终有效性，应用层不得用它推导会员身份。
- **退款状态异步**：受理不能等同完成，必须用回调及渠道查单更新；通知送达失败不回滚微信支付/退款结果。
- **Webhook 安全**：必须限制 HTTPS 目标并防止内网访问，签名密钥须加密与轮换；失败事件需可观测并可安全重放。
- **前缀兼容**：架构文档现有规则把 open API 归入 `/app-api`，本设计修订为独立前缀；旧 app API 不迁移，现有 OAuth token URL保持兼容。
- **支付场景**：首期已确认微信 JSAPI，客户端须提供 OpenID，并使用对应租户小程序/公众号的应用身份；不含 Native、MWEB、商家转账和托管收银页。

## 7. 后续交付门禁

- 完成 `contract-changes.md` 中的 DTO、状态、错误、scope 和 Webhook 签名/重试契约冻结后才开始实现。
- 需要跨 backend/admin 实现；后端迁移、client 绑定与 token tenant 隔离先于 admin 消费端联调。
- E2E 至少覆盖支付创建、真实微信回调或受控回调替身、重复回调、全额退款和 Webhook 重试；测试不得使用生产密钥。
