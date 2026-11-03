# 第三方支付 OpenAPI 变更报告

## 业务结果

- 提供独立 `/open-api` 客户端凭证 token 和支付 API，支持微信 JSAPI 与 Adapay 创建支付、支付查询、全额退款。
- OpenAPI 支付单保存并返回通用 `payType` 渠道标识；支持 `weixin`、`adapay`，字段值沿用平台现有支付渠道标识。
- 原方案在 OAuth2 客户端页配置租户绑定和 Webhook；按最新需求移除这些专属配置，scope 采用逗号分隔文本，支付配置页维护 OpenAPI 开关和 Webhook 地址。
- 支付通知异步投递、记录状态、有限重试；管理员可查看最近投递记录并重放失败事件。

## 影响仓库

- `backend`：system OAuth2 OpenAPI 认证；pay 支付适配、订单/事件记录、微信回调消费、查单退款及通知投递。
- `admin`：OAuth2 客户端 scope/支付配置表单和 Webhook 投递管理。
- `governance`：需求、设计、契约、验证、审查和交付记录。

## 契约与迁移

- 新增 `/open-api/oauth2/token`、`/open-api/v1/payments` 支付接口和管理端配置/事件接口。
- 新增 `V2026110201__third_party_payment_openapi.sql`，创建 OpenAPI 支付单和 Webhook 事件表。后续迁移删除客户端绑定表，并在 `merchant_details` 增加 OpenAPI 开关与 Webhook 字段。
- `merchant_details` 继续作为微信商户配置唯一来源；第三方商家转账和用户确认收款不在首期范围。

## 验证

- backend `mvn -pl yshop-module-system/yshop-module-system-biz,yshop-module-pay/yshop-module-pay-biz -am test`：438 项通过，0 失败，1 跳过。
- admin `NODE_OPTIONS=--max_old_space_size=8192 pnpm build:prod`：通过。
- admin `pnpm ts:check`：受仓库既有全量类型错误影响未通过；详情见 `test-notes.md`。
- 微信支付/退款/Webhook E2E：未运行，需在隔离测试租户完成。

## 残余风险

- 支付渠道回调、退款异步结果、数据库迁移和第三方 Webhook 尚未在集成环境联调。
- admin 全量 TypeScript 检查仍需解决既有全局类型声明问题。

## 建议 PR 标题

`feat(payment): 增加第三方支付 OpenAPI`
