# CHANGE-REPORT：服务订单审批通过短信通知

## 业务结果

- 服务订单从待审核变为审核通过后，事务提交后向下单 Member 用户发送审批通过短信。
- 使用模板 `service_approval_notification`，传递预约时间和租户名称。
- 审批拒绝不发送；拒绝后重新提交并通过时再次发送。
- 短信异常不回滚审批结果。

## 影响仓库

- `backend`：服务订单审批、系统租户 API、服务订单单元测试。
- `admin` / `miniapp` / `icepolar-dms`：无变更。

## 契约/迁移

- 扩展内部 `TenantApi#getTenantName(Long)`。
- 复用现有 `SmsSendApi`、短信日志和短信 MQ，不新增 HTTP API 或 MQ schema。
- 无数据库 schema 变更，无 SQL 迁移脚本。

## 验证结果

- `mvn -pl yshop-module-site/yshop-module-site-biz -am -DskipTests package`：pass。
- `mvn -pl yshop-module-site/yshop-module-site-biz -am -Dtest=AppSiteOrderServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：pass，3 tests。
- 完整 `-am test`：受既有 `yshop-module-pay-biz` 测试失败影响，未能全绿；详见 `test-notes.md`。

## 残余风险

- 短信模板和短信平台配置需要在各环境完成并进行真实发送联调。
- 事务提交后进程崩溃可能导致短信未触发，本期不提供补偿机制。

## 建议 PR 标题

`feat(site): send sms after service order approval`

## 建议 PR 描述

新增服务订单审批通过短信通知。审批状态通过原子更新保证并发安全，事务提交后复用现有短信 API/MQ 向下单用户发送 `service_approval_notification`，传递预约时间和租户名称；短信失败不影响审批结果。无数据库迁移和前端改动。目标模块测试通过；完整测试受既有 pay 模块基线测试失败影响。
