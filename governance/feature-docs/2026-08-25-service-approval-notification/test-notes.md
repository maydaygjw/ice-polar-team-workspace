# 测试说明：服务订单审批通过短信通知

## 当前状态

实现已完成。本功能代码位于 backend worktree：
`/Users/gejunwen/code/holun-team/ice-polar-team-workspace/.worktrees/backend-service-approval-notification`。

## 单元测试

目标模块：`yshop-module-site/yshop-module-site-biz`。

- 审批通过：验证待审核订单原子更新成功，并在事务提交回调中调用 `SmsSendApi`，模板编码和 `time`、`tenant` 参数正确。
- 审批拒绝：验证不调用短信 API。
- 拒绝后重新提交再通过：验证第二次待审核到通过会再次调用短信 API。
- 已审批订单：验证抛出现有重复审批错误，不调用短信 API。
- 并发/原子更新失败：模拟更新影响行数为 0，验证抛出重复审批错误且不注册短信回调。
- 短信 API 抛异常：验证审批方法已完成的状态更新不被短信异常回滚；记录错误日志。
- 租户名称获取失败：验证不影响审批结果且不发送不完整参数短信。
- 时间格式：验证 `LocalDateTime` 输出为 `yyyy-MM-dd HH:mm`。

目标模块：`yshop-module-system/yshop-module-system-biz`。

- `TenantApi.getTenantName` 能按租户 ID返回名称。
- 租户不存在时返回既定错误语义。

## 集成/回归验证

实现后建议执行：

```bash
(cd backend && mvn -pl yshop-module-site/yshop-module-site-biz -am test)
(cd backend && mvn -pl yshop-server -am package -DskipTests)
```

使用已配置的测试短信模板验证：

1. 后台审批通过一笔待审核服务订单。
2. 确认审批状态已变为审核通过。
3. 确认 `system_sms_log` 生成模板编码为 `service_approval_notification` 的日志。
4. 确认日志参数为预约开始时间和租户名称。
5. 确认短信 MQ 消费成功或失败结果可追踪。
6. 验证事务回滚场景不产生短信日志/发送消息。

## 配置前置条件

- 测试环境已配置 `service_approval_notification` 系统短信模板。
- 模板系统参数使用 `{time}`、`{tenant}`，并与短信平台审核模板一致。
- 测试租户存在名称，测试订单关联有效 Member 用户和手机号。
- 短信渠道、API 模板 ID 和测试密钥通过环境配置提供，不提交到仓库。

## 实际验证结果

- `mvn -pl yshop-module-site/yshop-module-site-biz -am -DskipTests package`：通过。
- `mvn -pl yshop-module-site/yshop-module-site-biz -am -Dtest=AppSiteOrderServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，3 tests。
- `git diff --check`：通过。
- 首次执行 `mvn -pl yshop-module-site/yshop-module-site-biz -am test` 未通过：在 site 模块之前的既有 `yshop-module-pay-biz` 测试失败，包含 3 个 `YuePayServiceTest` 的 `UserBillApi` NPE 和 1 个 `ProfitRecipientServiceImplTest` 断言失败；未执行到 site 测试，和本次改动无直接关联。

## 未执行项

- 真实短信供应商发送：未执行，需要各环境完成 `service_approval_notification` 模板、渠道和 API 模板 ID 配置后验证。
- 完整 backend 测试：受上述基线 pay 模块测试失败影响，未能获得全仓库绿色结果。

## Test 部署记录（2026-08-25）

- 部署来源：backend `master`，合并提交 `f594d09fb9fe0d2cdfee42b013b0f0c7addcb750`。
- 构建：`mvn clean -pl yshop-server -am package -DskipTests` 通过；本地构建 JDK 为 17，产物 target 为 17，test 运行时为 Java 21.0.11。
- 制品 SHA-256：`ec21f91f05c9a7064cd6a16a7680478f7986c5748576d85c43b0d0a2c6ec62a9`。
- 运行状态：test `dev` profile，PID `1883241`，监听 `8888`，HTTP 根路径返回 200，启动日志显示应用正常启动。
- 回滚备份：`/opt/holun/yshop-drink/yshop-server/target/yshop-server.jar.bak.20260825192702`。
