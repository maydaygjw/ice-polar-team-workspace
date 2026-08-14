# 企业微信客户添加欢迎语自动发送测试计划

## Preconditions

- test 环境已存在企业微信配置、回调 Token/EncodingAESKey 和客户联系 Secret。
- 至少存在一个启用商圈和启用欢迎语模板，模板已完成企业微信图片素材上传。
- 至少有两个商圈：一个有启用模板，一个无模板或模板已停用。
- 使用企业微信测试账号/测试客户；真实客户发送必须得到业务确认。
- 默认自动化测试使用 HTTP mock，不调用真实企业微信发送接口。

## Unit and Integration Scenarios

| 编号 | 场景 | 预期 |
|---|---|---|
| EVT-01 | 合法事件验签解密 | 提取 Event、ChangeType、UserID、ExternalUserID、State、WelcomeCode 并成功入队 |
| EVT-02 | 非目标事件 | 验签成功但不入欢迎语 Stream，仍返回 success |
| EVT-03 | 非法签名/CorpID/XXE | 返回非法请求，不入队、不发送 |
| EVT-04 | State 匹配启用商圈 | 使用正确租户、账户和商圈模板 |
| EVT-05 | State 为空/未知/停用商圈 | 记录 SKIPPED，不调用 send_welcome_msg |
| EVT-06 | 模板停用/不存在/图片缺失 | 记录 SKIPPED，不调用外部发送 |
| EVT-07 | 正常发送 | 请求包含 welcome_code，attachments 顺序为 text、image，记录 SENT |
| EVT-08 | 重复 WelcomeCode 并发消费 | 只有一次实际外部发送，后续消费幂等结束 |
| EVT-09 | 外部调用前的内部异常 | 记录 FAILED 并 ACK，不能因 Redis 延迟重试造成外部发送 |
| EVT-10 | 欢迎码失效/权限错误 | 只调用一次，记录 FAILED 并 ACK |
| EVT-13 | 外部请求超时/结果不明确 | 只调用一次，记录 UNKNOWN、告警并 ACK，不自动重发 |
| EVT-11 | 租户隔离 | 租户 A 的 State/模板不能匹配租户 B，发送记录按租户隔离 |
| EVT-12 | 敏感信息日志 | 完整 WelcomeCode、Secret、access token、完整 XML 不出现在日志 |

## E2E Scenarios

| 编号 | 场景 | 预期 |
|---|---|---|
| E2E-01 | 测试客户通过带 State 的联系我二维码添加员工 | 回调收到后，客户收到文字+图片欢迎语 |
| E2E-02 | 两个商圈分别使用不同 State 和模板 | 两次添加分别发送对应商圈模板 |
| E2E-03 | 停用模板后再次添加客户 | 不发送欢迎语，发送记录为 SKIPPED |
| E2E-04 | 企业微信重试同一回调 | 不产生重复欢迎语 |
| E2E-05 | 企业微信发送接口返回失败或超时 | 回调不阻塞；确定性失败为 FAILED，结果不明确为 UNKNOWN，均不重复调用 |

## Regression

- 现有企业微信回调 URL 验证仍返回正确 `echostr`。
- 其他企业微信事件仍可验签、记录和成功返回。
- 联系我创建/更新仍将商圈 code 写入企业微信 State。
- 欢迎语模板创建、编辑、删除、启停和图片上传不受影响。
- 公众号、客户群同步和客户联系人管理不受影响。

## Test Evidence To Record

- backend 目标模块单元测试和 Redis Stream 消费测试结果。
- mock 企业微信 API 收到的脱敏请求摘要。
- 数据库发送记录状态、唯一索引和重试次数。
- test 环境真实 E2E 是否执行；若未执行，必须写明未执行原因，不得将 mock 结果描述为真实发送。
