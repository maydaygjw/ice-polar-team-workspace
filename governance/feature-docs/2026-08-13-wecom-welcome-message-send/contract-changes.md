# 企业微信客户添加欢迎语自动发送契约变更

## API / Callback

现有回调入口保持不变：

| Method | Path | Semantics |
|---|---|---|
| GET | `/mp/wecom/callback/{accountId}` | 企业微信回调 URL 验证，返回解密后的 `echostr` |
| POST | `/mp/wecom/callback/{accountId}` | 验签、解密并投递企业微信事件；有效请求快速返回纯文本 `success` |

POST 解密事件内部契约：

```json
{
  "event": "change_external_contact",
  "changeType": "add_external_contact",
  "userId": "zhangsan",
  "externalUserId": "wo...",
  "state": "business-region-code",
  "welcomeCode": "WECOM_WELCOME_CODE",
  "eventTime": 1700000000,
  "receivedAt": 1700000000123
}
```

`welcomeCode` 只在内部消息和发送调用链路中传递，不进入普通日志、管理端 API 或持久化明文。

## Internal Message / MQ

新增 Redis Stream 消息语义，消息需携带租户上下文：

```json
{
  "accountId": 1,
  "userId": "zhangsan",
  "externalUserId": "wo...",
  "state": "business-region-code",
  "welcomeCode": "WECOM_WELCOME_CODE",
  "eventTime": 1700000000,
  "receivedAt": 1700000000123
}
```

- 生产者：`WecomCallbackService`，仅在回调验签/解密/CorpID 校验成功后发送。
- 消费者：企业微信欢迎语发送消费者，在租户上下文中查询商圈、模板并调用外部接口。
- 消费者对处理成功、跳过、失败或未知结果均 ACK；发送接口调用结果不明确时不得自动重发。只有回调入队失败才返回非成功响应，交由企业微信重试。
- 不新增跨仓消息消费者；本期只影响 backend。

## Database

新增 `mp_wecom_welcome_send_record` 发送处理记录表：

| 字段 | 说明 |
|---|---|
| `id` | Long 主键 |
| `tenant_id` | 租户标识 |
| `account_id` | 企业微信配置 ID |
| `business_region_id` | 匹配到的商圈 ID，可为空 |
| `welcome_code_hash` | WelcomeCode 单向摘要，用于幂等，不保存明文 |
| `state` | 事件 State 快照 |
| `user_id` | 企业成员 ID |
| `external_user_id` | 外部联系人 ID |
| `text_content` | 实际发送文字快照 |
| `wecom_image_url` | 实际发送图片 URL 快照 |
| `status` | `PROCESSING` / `SENT` / `SKIPPED` / `FAILED` / `UNKNOWN` |
| `attempt_count` | 已尝试次数 |
| `error_code` | 企业微信错误码，可为空 |
| `error_message` | 脱敏错误摘要 |
| `event_time` | 企业微信事件时间 |
| `send_started_time` | 开始调用发送接口时间 |
| `sent_time` | 成功发送时间 |
| `creator/create_time/updater/update_time/deleted` | 标准审计字段 |

约束：

- 唯一索引：`tenant_id, account_id, welcome_code_hash, deleted`；事件重复时复用同一记录。
- 查询索引：`tenant_id, account_id, status, create_time`。
- 继承租户 BaseDO；所有查询和写入均在租户上下文中执行。
- WelcomeCode 只保存 SHA-256 摘要，禁止为“方便重试”落明文。

迁移脚本：`backend/sql/upgrade-2026-08-13-wecom-welcome-message-send.sql`。

## External API

调用企业微信客户欢迎语发送接口：

```text
POST /cgi-bin/externalcontact/send_welcome_msg?access_token={access_token}
```

请求体：

```json
{
  "welcome_code": "WECOM_WELCOME_CODE",
  "text": {
    "content": "您好，欢迎添加我们！"
  },
  "attachments": [
    {
      "msgtype": "image",
      "image": {
        "pic_url": "https://p.qpic.cn/..."
      }
    }
  ]
}
```

本期只发送 `text` 和一个 `image`，文字在前、图片在后；`image.pic_url` 必须是企业微信上传图片接口返回的 URL。本接口要求在收到事件后 20 秒内调用，且同一个 `welcome_code` 只能调用一次。不调用 `group_welcome_template/*`，不创建企业微信远端模板。

## Permissions / Data Scope

N/A：不新增管理端权限。事件处理使用回调账户所属租户上下文，发送记录仅供后端内部处理和审计，不暴露管理端查询接口。

## Error Semantics

- 回调验签、解密、CorpID 校验失败：HTTP 400 `invalid request`。
- 回调入队失败：HTTP 非成功响应，允许企业微信重试。
- 无匹配商圈/模板/图片：发送记录 `SKIPPED`，回调不因业务跳过失败。
- 外部确定性错误：发送记录 `FAILED`，ACK 消息。
- 外部请求超时或结果不明确：发送记录 `UNKNOWN`，告警并 ACK；禁止自动再次调用，避免重复发送。
- 消费者内部处理异常且尚未调用外部接口时记录 `FAILED` 并 ACK，避免延迟重试导致 WelcomeCode 过期。

## Official References

- [企业微信事件格式](https://developer.work.weixin.qq.com/document/path/92130)：客户添加外部联系人事件及 `WelcomeCode` 回调字段。
- [企业微信发送新客户欢迎语](https://developer.work.weixin.qq.com/document/path/92137)：发送接口、20 秒有效期、单次调用约束及图片 `pic_url` 要求。
- 用户提供的 [入群欢迎语素材管理](https://developer.work.weixin.qq.com/document/path/92366) 属于客户群入群场景，本功能明确不使用。
