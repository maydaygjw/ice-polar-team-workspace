# 企业微信客户添加欢迎语自动发送技术设计

## Module Impact

- `backend/yshop-module-mp`：扩展回调 XML 解析、欢迎语事件投递、欢迎语发送服务和企业微信 API 客户端。
- `backend/yshop-module-mp`：新增发送记录 DO、Mapper、服务和 Redis Stream 消息消费者。
- `backend/yshop-module-mall/yshop-module-store-api`：复用已有 `BusinessRegionQueryApi.getEnabledRegionByCode`，不新增跨模块依赖。
- `backend/sql`：新增发送记录表和索引；不修改既有欢迎语模板表结构。
- `admin`：N/A，已有模板启停开关直接作为发送前置条件。
- `miniapp`、`icepolar-dms`：N/A。

## Key Decisions

1. **回调快速返回，发送异步执行**：企业微信回调线程只完成验签、解密、业务事件识别和 Redis Stream 投递，避免外部 HTTP 延迟阻塞回调响应。
2. **复用现有 State 语义**：联系我配置创建时把商圈 `code` 写入企业微信 `state`；消费者通过当前租户的 `getEnabledRegionByCode` 找到商圈，不依赖 contact-way 表反查，也不把数据库 ID 暴露为 State。
3. **模板消费时读取，保存发送快照**：事件入队时不复制模板；消费者读取当时启用的模板，随后把文字和图片 URL 写入发送记录，保证审计可还原。
4. **WelcomeCode 只做一次性目标**：外部发送接口必须使用事件返回的 WelcomeCode；数据库只存摘要。重复事件用 `tenant_id + account_id + welcome_code_hash` 幂等。
5. **遵守 WelcomeCode 一次性约束**：WelcomeCode 仅在事件后 20 秒内有效，外部发送接口最多调用一次。消费者异常直接记录终态并 ACK，避免 Redis pending 延迟重试导致凭证过期；外部请求超时或结果不明确时记录 `UNKNOWN`，禁止自动重发。
6. **不把发送成功等同于客户已读**：`SENT` 只代表企业微信接口接受请求；不声称客户已收到或阅读。

## Flow

```text
企业微信 POST 回调
  -> 账户查询（忽略租户上下文）
  -> AES 解密 + XML 安全解析 + CorpID 校验
  -> 判断 change_external_contact/add_external_contact
  -> 提取 UserID / ExternalUserID / State / WelcomeCode
  -> Redis Stream 投递（TenantRedisMessageInterceptor 写入 tenant_id）
  -> 立即返回 success

Redis Stream 消费者
  -> 恢复 tenant_id
  -> SHA-256(WelcomeCode) 查找/抢占发送记录
  -> State -> 当前租户启用商圈
  -> 查询 account_id + business_region_id + status=1 的模板
  -> 保存 PROCESSING 与文字/图片快照
  -> 调用 externalcontact/send_welcome_msg
  -> 成功：SENT；跳过：SKIPPED；确定性失败：FAILED；结果不明确：UNKNOWN
  -> ACK
```

## Callback Parsing

- 继续使用现有安全 XML 解析限制：禁止 DOCTYPE、外部实体、XInclude，并限制解密 XML 大小。
- 解析结果使用内部事件对象，不把完整 XML 传入 MQ；同时记录企业微信 `CreateTime` 和系统收到时间，用于在 20 秒有效期内判断是否还允许发送。
- 日志只记录 `accountId`、tenantId、event、changeType、State 摘要、外部联系人 ID 脱敏值和处理结果；WelcomeCode 只记录 hash 前缀或不记录。
- 未知事件保留现有“验签后记录并成功返回”行为。

## Idempotency and Concurrency

- 以 SHA-256(WelcomeCode) 作为事件幂等键；同一租户和账户的重复事件命中同一发送记录。
- 使用数据库唯一索引兜底，并在消费前使用短时分布式锁减少并发重复发送。
- `SENT`、`SKIPPED`、`FAILED`、`UNKNOWN` 记录均不再调用外部发送接口；发现遗留 `PROCESSING` 记录时转为 `UNKNOWN`，不再次使用 WelcomeCode。
- 外部调用成功而本地状态更新失败时无法实现绝对 exactly-once；通过发送前 `PROCESSING`、唯一键、锁和成功后状态更新降低重复概率，并将该残余风险写入审查结论。

## Template Matching

- `State` 为空：直接 `SKIPPED(NO_STATE)`。
- `getEnabledRegionByCode(state)` 为空：`SKIPPED(REGION_NOT_FOUND_OR_DISABLED)`。
- 模板查询条件：当前租户、事件 accountId、商圈 ID、`status=1`、未删除。
- 模板不存在：`SKIPPED(TEMPLATE_NOT_FOUND_OR_DISABLED)`。
- `textContent` 或 `wecomImageUrl` 为空：`SKIPPED(TEMPLATE_CONTENT_INVALID)`。
- 模板查询与发送记录写入必须继承 Redis 消费消息恢复的租户上下文。

## Retry Classification

| 类型 | 示例 | 处理 |
|---|---|---|
| 消费处理异常 | 租户上下文、模板查询或发送记录写入异常，且尚未调用外部接口 | 记录 `FAILED` 并 ACK，避免延迟重试导致 WelcomeCode 过期 |
| 外部确定性失败 | WelcomeCode 失效、参数错误、权限不足、图片 URL 无效 | `FAILED` 并 ACK，不再次调用 |
| 外部结果不明确 | 请求超时、连接在请求发出后中断、无法判断企业微信是否已接受 | `UNKNOWN`、告警并 ACK，不再次调用 |
| 业务跳过 | State/商圈/模板缺失、模板停用 | `SKIPPED` 并 ACK |

## Migration and Rollback

- 新增表使用 dated upgrade SQL，脚本需可重复执行。
- 回滚只删除本功能新建的发送记录表和索引，不删除欢迎语模板、联系我配置或企业微信素材。
- 回滚前必须停止或隔离消费者，避免回滚期间消费者写入已删除表。
- 已发送的企业微信消息不可通过本地回滚撤回，迁移回滚不承诺撤回外部消息。

## Risks

- 外部发送接口缺少与本地事务绑定的幂等协议，存在极小重复发送窗口。
- 企业微信 WelcomeCode 只有 20 秒有效期，回调重试可能使事件过期；必须在发送前检查时间窗口，并用 `welcome_code_hash` 和发送记录 ID 关联告警。
- State 是外部配置中的字符串；联系我配置修改或删除后，历史事件可能无法匹配，按业务跳过处理。
- 发送记录包含文字和图片 URL 快照，需控制错误信息长度并避免保存 Secret/access token。
