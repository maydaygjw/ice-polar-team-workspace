# 第三方支付 OpenAPI 验证记录

## Backend

- `mvn -pl yshop-module-system/yshop-module-system-biz,yshop-module-pay/yshop-module-pay-biz -am test`：通过；system/pay 及其依赖模块共 438 项测试，0 失败、0 错误、1 跳过。
- 最终验证在 Webhook 存量订单通知修复和事件唯一约束调整后执行。
- 增加 `pay_type` 字段并纳入支付响应后，`mvn -pl yshop-module-pay/yshop-module-pay-biz -am test`：44 项测试通过，0 失败、0 错误、0 跳过。
- 将 OpenAPI mapper 查询改为 `LambdaQueryWrapperX` DSL 后，同一命令再次通过：44 项测试通过，0 失败、0 错误、0 跳过；新 mapper 中无 `@Select`/原生查询注解。
- 编译期间有现有 MapStruct 未映射字段警告；不影响构建结果。

## Admin

- `pnpm install --frozen-lockfile`：通过。
- `NODE_OPTIONS=--max_old_space_size=8192 pnpm build:prod`：通过。
- `pnpm ts:check`：未通过。仓库全量类型检查报告多个既有全局声明/接口类型缺失；定向检查本次改动文件时发现并修正了客户端编号可空错误，剩余输出是既有的 `MerchantDetailsPageReqVO` 未声明错误。生产构建通过，但不能替代类型检查。

## E2E

- 未运行真实微信 JSAPI、支付回调、退款及 Webhook 接收端联调。当前环境没有可确认的微信商户测试凭据、MQ/数据库联调配置和第三方接收端。
- 上线前需要按 `test-plan.md` 在隔离测试租户执行端到端验证；不得使用生产支付密钥。

## 静态检查

- backend/admin `git diff --check`：通过。
