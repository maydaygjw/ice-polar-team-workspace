# 第三方支付 OpenAPI 技术设计

## 1. 设计目标

为第三方服务端提供独立的 OAuth2 client-credentials OpenAPI，覆盖微信 JSAPI 与 Adapay 支付创建、支付查询、全额退款、微信商家转账发起和交易结果 Webhook。复用现有 OAuth2 客户端/令牌能力、商户配置、支付 SDK、渠道通知验签和支付记录能力；不让第三方接触支付渠道商户密钥，不改变会员端 `/app-api` 的身份和支付流程。

## 2. 模块影响

| 模块 | 变化 |
|---|---|
| `system` 后端 | 增加仅支持 `client_credentials` 的 OpenAPI token 入口；从现有 `tenant-id` 请求头解析并固化租户，不新增客户端支付配置表。 |
| `pay` 后端 | 新增 OpenAPI 支付订单编排、查询、全额退款、微信商家转账发起、渠道终态通知处理及 Webhook 投递；复用当前租户的微信或 Adapay 支付配置和 SDK。 |
| `admin` | OAuth2 客户端通用表单以逗号分隔文本维护 scope；支付配置表单提供 OpenAPI 启用项和 Webhook 地址。 |
| `governance` | 独立 OpenAPI 前缀和功能契约记录；机器 API 快照待实现后生成。 |

不修改 `miniapp`、H5 或 DMS。第三方自身客户端仍负责把服务端返回的 JSAPI 参数交给微信客户端调起支付。

微信商户凭据及 OpenAPI 启用开关、Webhook 地址均保存在 pay 模块现有 `merchant_details` 表，由“支付服务商配置”页面维护。token 申请要求 `tenant-id` 请求头，租户 ID 写入 token；pay 模块按 token 当前租户和渠道读取唯一启用的支付配置，不保存 client 到支付配置的绑定。

## 3. 关键决策

### 3.1 独立接口与 OAuth 身份

- 资源接口使用 `/open-api/v1/**`，令牌接口使用 `POST /open-api/oauth2/token`。现有 `/admin-api/system/oauth2/token` 保持兼容，不改变现有 OAuth 客户端用途。
- Web MVC 按 Controller 包自动添加前缀：`controller.admin` 自动获得 `/admin-api`，`controller.app` 自动获得 `/app-api`，`controller.openapi` 自动获得 `/open-api`。OpenAPI Controller 的 `@RequestMapping` 只声明自身路由段；框架前缀规则不与 `/admin-api` 重复叠加。OpenAPI token 路径不加入租户忽略列表；沿用多租户过滤器校验 `tenant-id` 请求头。
- 新 token 入口只允许 `client_credentials`，使用 HTTP Basic 客户端认证；不支持 password、authorization_code、refresh token。
- token 主体仍为 `UserTypeEnum.CLIENT`，每个业务请求除检查 scope 外，必须检查主体类型、客户端启用状态及 token 租户上下文。支付创建还必须检查当前租户指定渠道已启用 OpenAPI 的支付配置。
- 现有 OAuth2 客户端保持通用，不附加租户归属。token 申请必须携带经多租户过滤器校验的 `tenant-id`；系统把当前租户写入 CLIENT token，后续请求要求 token 租户与请求头租户一致。支付配置的 OpenAPI 开关负责控制该租户能否使用对应渠道。
- OpenAPI 开关按租户/渠道授权：该租户下所有持有有效 OAuth2 客户端凭证、并申请到对应 scope 的客户端均可调用；不提供按 client 单独限制 tenant/payment config 的关系表。
- 访问令牌申请时，scope 可省略；省略时授予客户端配置的全部 scope。显式请求的 scope 必须被客户端精确授权。不支持通配符。支付和商家转账资源接口统一检查 `payment` scope。取消授权后，已签发令牌至多在其有效期内继续使用；客户端停用即时拒绝，降低存量令牌等待到期的风险。

### 3.2 Scope 管理

- 使用现有 OAuth2 客户端的 `scopes` 列表保存已授予范围，不新增一份重复授权关系。
- admin 在通用 OAuth2 客户端表单中以逗号分隔文本维护 scope，不通过枚举控件穷举。OpenAPI 不支持 scope 通配符；令牌申请可省略 scope（默认授予客户端配置的全部 scope），支付和商家转账资源接口统一识别 `payment` scope。
- OAuth2 客户端编辑表单不显示 OpenAPI 专属配置；scope 改用逗号分隔文本，保存时转回现有 scope 列表。
- 支付和商家转账 API 统一使用 `payment` scope；新操作仍须检查该 scope、租户、客户端和各自的业务约束。

### 3.3 支付单归属和复用支付网关

- 新增 `pay_open_api_order`，作为第三方订单号、客户端、平台支付单和支付/退款状态之间的业务关联；不把外部订单伪装成商城订单，也不触发商城履约。
- 唯一约束为 `(tenant_id, client_id, client_order_no)`、`(tenant_id, client_id, create_idempotency_key)`；平台支付单号另有租户内唯一约束。记录保存关键请求摘要。创建时在事务/锁保护下检查订单号和幂等键，防止并发重复创建。
- OpenAPI 支付编排留在 `pay` 模块，使用当前租户唯一启用 OpenAPI 的微信 JSAPI 商户配置（小程序或公众号）和微信支付 SDK 创建预支付单。`payerOpenId` 只用于创建预支付单，不作为订单归属凭证；禁止记录到普通日志，除非渠道排障确需且须脱敏。
- 不复用当前 `PayOrderApi.createPayOrder` 的会员 ID 假设：该 API 的 JSAPI 路径通过 `MemberUserApi` 从会员读取 OpenID。OpenAPI 接收调用方提供的 JSAPI `payerOpenId`，并用独立编排服务将其传给现有支付网关。退款与查单按平台支付单关联的 `outPayNo` 操作，不接受请求方指定渠道商户配置。
- 微信回调由现有 `WxPayMessageHandler` 完成验签/解密；Adapay 回调由现有 Adapay handler 完成验签并更新 OpenAPI 状态。支付记录以 `bizType=open_api` 区分；支付通知流新增 OpenAPI 专用消费组，更新 `pay_out_order_no` 和 `pay_open_api_order`，不调用商城订单支付/履约逻辑。
- 支付状态采用 OpenAPI 稳定枚举：`PENDING`、`SUCCESS`、`FAILED`、`CLOSED`；退款状态独立为 `NOT_REFUNDED`、`PROCESSING`、`SUCCESS`、`FAILED`。渠道原始状态仅作为内部映射依据。

### 3.4 商家转账发起

- 新增 `pay_open_api_transfer`，关联租户、OAuth2 client、第三方业务订单号及平台用户转账记录/微信商户单号；使用 `(tenant_id, client_id, client_order_no)` 和 `(tenant_id, client_id, idempotency_key)` 唯一约束防止重复转账。内容一致的重试返回同一笔转账，金额、收款方摘要或备注不同则冲突。
- OpenAPI 只允许微信商家转账。调用方提交当前租户会员 `userId`；Pay 模块读取该会员的 `routineOpenid`，并校验其对应当前租户已配置的小程序 AppID。API 不接收 OpenID、AppID、商户号或商户密钥；OpenID 只在发起微信请求时读取使用，不复制到 OpenAPI 关联表或日志。
- Pay 模块复用现有 APIv3 商家转账服务与 `yshop_pay_member_transfer_record`，创建统一用户转账记录；OpenAPI 关联表保留 client 与外部订单隔离关系。不创建虚构会员，也不触发商城订单或活动兑奖逻辑。
- 金额为 CNY 正整数分；AppID、APIv3 商户配置、转账场景 ID 和场景报备信息从当前租户服务端配置读取。转账能力、场景报备或 OpenAPI 开关未配置时拒绝请求；会员不存在、跨租户或缺少 `routineOpenid` 时拒绝请求。
- 创建响应返回 `outBillNo`、`transferBillNo`、微信状态、金额、`appId`、`mchId` 和 `packageInfo`。`packageInfo` 供集成方小程序调起用户确认收款，不代表到账；为幂等重试恢复响应而短期保存时，设置过期清理并禁止写普通日志。
- 微信 `MCHTRANSFER.BILL.FINISHED` 回调更新统一转账记录和 OpenAPI 关联记录；状态转移与转账 Webhook outbox 原子提交。长期非终态订单通过查单兜底。未知响应结果复用原商户单号查单/重试，不生成新转账单。

### 3.5 Webhook 可靠投递

- 支付状态事务内写入 `pay_open_api_webhook_event` 投递记录；后台任务从待投递记录发送至该客户端预设地址，避免在微信回调请求线程内同步调用第三方。
- 每条事件有稳定唯一 `eventId`，请求体带事件类型、支付/转账及外部订单标识、金额/币种、终态与发生时间。Webhook 以 HTTP/HTTPS POST 发送 JSON 明文，不额外签名或加密；通过 `eventId` 去重。
- 接收方返回 2xx 即确认。首次状态变化后立即发送，HTTP 超时 5 秒；超时、网络错误和非 2xx 最多投递 8 次，重试间隔为 1 分钟、5 分钟、30 分钟、2 小时、6 小时、12 小时和 24 小时。超过上限后保留失败状态，管理员可重放原事件；不反复阻塞支付回调。投递为至少一次，接收方按 `eventId` 幂等处理。
- Webhook 地址保存在当前支付配置，只允许 HTTP/HTTPS；投递端禁止内网、环回和链路本地目标，采用解析后地址校验和关闭重定向，降低 SSRF 风险。

## 4. 数据模型增量

具体字段长度遵循现有迁移和数据库规范；以下描述业务字段，不是最终 DDL。

### OpenAPI 支付配置字段（`merchant_details`）

- `open_api_enabled`：当前支付配置是否允许外部 OpenAPI 调用。
- `open_api_webhook_url`：支付状态通知 HTTP/HTTPS 地址，明文 JSON POST。
- 每个租户每个支付渠道最多启用一个 OpenAPI 配置；微信渠道在小程序/公众号中二选一，Adapay 使用其 H5 配置。

### `pay_open_api_order`

- 租户 ID、客户端 ID、外部业务订单号、平台支付单 ID、渠道外部订单号。
- `pay_type` 保存支付渠道，复用 `pay_out_order_no.pay_type` 的稳定值（如 `weixin`、`adapay`、`alipay`）；支持 `weixin` 与 `adapay`，表结构保持渠道通用。
- 金额（人民币分）、币种、标题、绑定的渠道 `payment_details_id`/可空渠道 AppID、支付状态、渠道交易号、支付创建/支付完成/过期时间。
- `payment_data` 为可空的渠道扩展 JSON；按 `pay_type` 保存微信 JSAPI 或 Adapay 收银参数，不把 JSAPI 字段提升为通用列。
- 创建幂等键及请求摘要；退款状态、唯一退款幂等键、退款单号、退款原因及退款完成时间。
- `payerOpenId` 不持久化；如渠道查单要求回传用户标识，应由微信侧数据满足，避免额外保存个人标识。
- 唯一约束：`(tenant_id, client_id, client_order_no)`；唯一约束：`(tenant_id, payment_id)`；查询索引覆盖 `tenant_id + client_id + payment_id`。

### `pay_open_api_webhook_event`

- `event_id` 唯一键，并以租户、资源类型（支付/转账）、资源 ID 和事件类型建立唯一约束防止重复状态通知；另含客户端 ID、序列化通知载荷、投递状态、尝试次数、下次投递时间、最后 HTTP 状态/错误摘要和审计时间。
- 索引待投递状态与下次投递时间；错误摘要不得包含签名密钥、访问令牌或完整支付凭据。

### `pay_open_api_transfer`

- 租户 ID、OAuth2 client ID、第三方业务订单号、转账幂等键、会员 ID、请求摘要、统一用户转账记录 ID、商户单号、微信转账单号、金额（分）、状态及创建/完成时间。
- 不保存收款 OpenID。`package_info` 如需用于同一请求幂等重放，作为短期敏感数据保存并按有效期清理；不得写入日志。

迁移放在 `backend/sql/migrations/`。迁移新增支付配置字段；仅当旧配置在租户内唯一且 Webhook 地址一致时迁移启用状态和地址，存在歧义的配置保持关闭；随后删除废弃的 `system_open_api_client_config`。保留 `pay_open_api_order`、`pay_open_api_transfer` 和 `pay_open_api_webhook_event` 以维护交易与通知审计数据。

## 5. 关键流程

### 获取 token

1. 第三方向 `/open-api/oauth2/token` 以 Basic 认证和 `tenant-id` 请求头提交 `grant_type=client_credentials` 及所需 scope。
2. 多租户过滤器校验租户，OAuth 服务校验客户端启用、授权类型正确、secret 匹配及请求 scope 属于客户端已授权集合。
3. 系统把当前租户写入 client access token，返回 Bearer token、有效期和最终授予 scope；不签发 refresh token。

### 创建支付单

1. 验证 CLIENT 主体、当前租户、`payment` scope、金额（正整数分）及 CNY；`payType` 默认 `weixin`，只允许 `weixin`/`adapay`，微信需校验 OpenID，按渠道读取当前租户启用的 OpenAPI 商户配置。
2. 以 `(tenant, client, clientOrderNo)` 锁定或唯一约束竞争；同订单同内容返回原支付单，同订单不同金额/币种/标题返回冲突。请求超时但渠道处理结果未知时，复用原平台支付单号查单，不另建可扣款支付单。
3. 创建平台支付关联记录及对应渠道的预支付单；Adapay outPayNo 在幂等重试中复用。服务端使用租户支付配置，不接收商户号、渠道配置 ID、notify URL 或支付密钥。
4. 返回 `paymentId`、订单号、金额、状态、过期时间、`appId` 和渠道 `paymentData`。第三方按渠道把支付数据传给付款客户端。

### 支付终态和查询

1. 微信支付回调经既有 SDK 验签/解密后产生现有支付通知消息。
2. OpenAPI 专用消费者根据 `bizType=open_api` 幂等更新支付映射和 API 支付单状态；以支付单状态转移成功作为唯一事件创建条件。
3. 同事务新增 Webhook outbox 事件。客户端可用支付 ID 或其订单号查询；平台查单作为通知补偿，浏览器/客户端成功页不改变支付状态。

### 全额退款

1. 校验 `payment`、支付单归属、支付成功、尚无成功/处理中退款。
2. 服务端以支付金额作为退款金额，并使用固定全额退款幂等标识发起原路渠道退款；请求不可提交部分金额。
3. 同一退款幂等键同内容返回原结果，不同内容冲突；微信状态由退款查询刷新；Adapay 退款处理中/成功/失败回调更新为 `PROCESSING`/`SUCCESS`/`FAILED`。
4. 退款状态变更写入 Webhook outbox，第三方也可查询支付单上的 refundStatus。

### 商家转账

1. 校验 CLIENT 主体、当前租户、`payment` scope、客户端状态、幂等键、正整数分金额及当前租户微信商家转账配置。
2. 校验 `userId` 属于当前租户且存在 `routineOpenid`；从服务端配置解析小程序 AppID 和已报备转账场景，再发起 APIv3 转账。OpenID 不进入 OpenAPI 关联记录。
3. 按 client + `clientOrderNo` 持久化关联；同单重试先查本地/微信状态，内容一致时复用原商户单号，会员、金额或备注不同返回冲突。
4. 返回用户确认参数和受理状态。微信终态通知或兜底查单更新状态，并生成 `transfer.succeeded`、`transfer.failed` 或 `transfer.cancelled` Webhook 事件。

## 6. 风险与权衡

- **租户头伪造**：token 请求必须走现有租户校验过滤器；资源请求比对请求头租户与 token 租户，并在支付查询/退款中同时按租户和 client 隔离。
- **商家转账收款人**：转账请求只接受当前租户会员 ID，Pay 模块从会员记录读取小程序 OpenID；不得接收第三方任意提供的 OpenID，防止绕过会员归属和 AppID 校验。
- **退款状态异步**：受理不能等同完成，必须用回调及渠道查单更新；通知送达失败不回滚微信支付/退款结果。
- **Webhook 安全**：Webhook 不做应用层签名/加密，仍必须限制 HTTP/HTTPS 目标并防止内网访问；接收方按 eventId 去重，失败事件需可观测并可安全重放。
- **前缀兼容**：架构文档现有规则把 open API 归入 `/app-api`，本设计修订为独立前缀；旧 app API 不迁移，现有 OAuth token URL保持兼容。
- **支付与转账场景**：微信支付创建使用 JSAPI，客户端须提供 OpenID；Adapay 复用现有 H5/小程序支付数据。微信商家转账使用当前租户会员 `userId`，并与其他支付 API 共用 `payment` scope，返回客户端调起用户确认收款所需参数；不开放独立转账查询/撤销接口。支付宝和平台托管收银页不在范围内。

## 7. 后续交付门禁

- 完成 `contract-changes.md` 中的 DTO、状态、错误、scope 和 Webhook 明文/重试契约冻结后才开始实现。
- 需要跨 backend/admin 实现；后端迁移与 token tenant 隔离先于 admin 消费端联调。
- E2E 至少覆盖支付创建、真实微信回调或受控回调替身、重复回调、全额退款和 Webhook 重试；测试不得使用生产密钥。
