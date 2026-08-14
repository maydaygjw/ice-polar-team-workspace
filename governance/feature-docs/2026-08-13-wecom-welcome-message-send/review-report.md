# 评审报告

## Review Scope

本报告对应治理文档阶段，检查客户添加欢迎语自动发送的范围、事件契约、租户隔离、异步可靠性、幂等和外部接口边界。

## Findings

- 已明确本功能处理的是客户添加外部联系人事件，不是客户群入群欢迎语。
- 已复用现有联系我配置的 State=商圈 code 语义，并定义了当前租户内的 State 匹配规则。
- 已定义 WelcomeCode 不落明文、不进普通日志，并使用 SHA-256 摘要作为幂等键。
- 已实现回调快速返回、Redis Stream 异步消费、发送记录和 ACK；遵守 WelcomeCode 20 秒有效期及单次调用约束。
- 已明确文字在前、图片在后，发送接口为 `externalcontact/send_welcome_msg`，不调用 `group_welcome_template/*`。

## Risks Requiring Implementation Attention

- 外部接口调用和本地状态更新无法组成 exactly-once 事务，必须保留重复发送残余风险并完善告警/审计。
- 消费者对处理异常统一记录终态并 ACK，已避免 Redis pending 延迟重投导致 WelcomeCode 过期。
- XML 解析字段和企业微信错误码需要使用 mock/官方协议样例覆盖，避免将其他回调事件误判为添加事件。
- 外部请求超时属于发送结果未知，不能简单按普通网络错误重试；实现必须保留 `UNKNOWN` 状态和告警路径。

## Conclusion

实现与本地验证已完成：模块测试 36 个通过，完整 backend reactor 构建成功，迁移脚本已静态核验。数据库执行、部署和真实 test 企业微信 E2E 尚未进行，需按发布流程授权后执行。
