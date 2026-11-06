# 第三方支付 OpenAPI 变更报告

## 业务结果

- 原有实现提供独立 `/open-api` 客户端凭证 token 和支付 API，支持微信 JSAPI 与 Adapay 创建支付、支付查询和全额退款；本次追加的商家转账 API 与支付操作统一使用 `payment` scope。
- OpenAPI 支付单保存并返回通用 `payType` 渠道标识；支持 `weixin`、`adapay`，字段值沿用平台现有支付渠道标识。
- 原方案在 OAuth2 客户端页配置租户绑定和 Webhook；按最新需求移除这些专属配置，scope 采用逗号分隔文本，支付配置页维护 OpenAPI 开关和 Webhook 地址。
- 支付通知异步投递、记录状态、有限重试；管理员可查看最近投递记录并重放失败事件。

## 影响仓库

- `backend`：system OAuth2 OpenAPI 认证；pay 支付适配、订单/事件记录、微信回调消费、查单退款及通知投递。
- `admin`：OAuth2 客户端 scope/支付配置表单和 Webhook 投递管理。
- `governance`：需求、设计、契约、验证、审查和交付记录。

## 契约与迁移

- 新增 `/open-api/oauth2/token`、`/open-api/v1/payments` 支付接口、`/open-api/v1/transfers` 商家转账接口及管理端配置/事件接口。
- 新增 `V2026110201__third_party_payment_openapi.sql`，创建 OpenAPI 支付单和 Webhook 事件表。后续迁移删除客户端绑定表，并在 `merchant_details` 增加 OpenAPI 开关与 Webhook 字段。
- `merchant_details` 继续作为微信商户配置唯一来源；商家转账复用当前租户已配置的 APIv3 能力，转账终态经现有 Webhook 通知，用户确认由集成方小程序完成。

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

## 追加契约（2026-11-06）

- 本次为功能文档补充 `POST /open-api/v1/transfers` 契约，限定当前租户会员、`payment` scope、幂等及微信转账终态 Webhook。
- 本次仅更新治理文档；上述转账 OpenAPI 和对应数据关联尚未在 backend/admin 实现，也未运行转账 E2E。实现前需按 `contract-changes.md` 落地契约和迁移，并执行更新后的 `test-plan.md`。
