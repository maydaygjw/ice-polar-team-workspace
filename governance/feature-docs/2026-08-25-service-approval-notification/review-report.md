# Review Report：服务订单审批通过短信通知

## 审查范围

- 服务订单审批状态更新与并发控制。
- 事务提交后的短信触发时机。
- Member 用户、租户名称和模板参数映射。
- 跨模块依赖、租户隔离、异常处理和测试覆盖。

## Findings

### Blocker

N/A。

### Major

N/A。

### Minor

1. `afterCommit` 是进程内回调，进程在事务提交后、回调执行前崩溃时可能造成审批成功但短信未发送。本期复用现有模式并接受该风险；若后续要求可靠补偿，应单独引入 Outbox/事务消息。
2. 系统模板内容使用 `{time}`、`{tenant}` 解析参数，而需求文本使用 `${time}`、`${tenant}`。上线前必须确认系统模板管理和短信供应商审核模板的占位符配置一致。

## Verification

- site 模块跳过测试编译：通过。
- `AppSiteOrderServiceImplTest`：3 tests 通过。
- 全链路测试：被已有 pay 模块测试失败阻断，失败点不在本功能。
- `git diff --check`：通过。

## Conclusion

通过。实现符合已确认需求，可进入人工联调和短信模板配置验证。未执行 commit、push 或 PR 操作。
