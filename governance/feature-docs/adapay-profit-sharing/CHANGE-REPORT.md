# CHANGE-REPORT: Adapay 分账结算

## 变更概述

实现基于 Adapay 三方支付的延迟分账与日终自动结算功能。支持分账收款人管理（平台级/店铺级）、店铺绑定收款人、Adapay 延迟分账、日终自动结算、失败回退与手动重试。

## 影响范围

| 模块/仓库 | 变更类型 | 说明 |
|-----------|----------|------|
| `backend/` | 新增 + 修改 | 分账收款人、分账订单、结算 Job、支付集成、店铺绑定 |
| `admin/` | 新增 + 修改 | 分账收款人管理页、分账结算记录页、店铺绑定配置 |
| `governance/` | 新增 + 修改 | Phase 1 设计文档、review 报告、OpenAPI 快照 |

## 新增表

- `yshop_adapay_profit_recipient` — 分账收款人
- `yshop_adapay_profit_sharing_order` — 分账订单记录
- `yshop_adapay_profit_sharing_log` — 分账操作日志

## 修改表

- `yshop_store_shop` 新增 `profit_sharing_recipient_id`、`profit_sharing_enabled`

## 新增 Admin API

- `POST /admin-api/pay/profit-recipient/create`
- `PUT /admin-api/pay/profit-recipient/update`
- `DELETE /admin-api/pay/profit-recipient/delete`
- `GET /admin-api/pay/profit-recipient/get`
- `GET /admin-api/pay/profit-recipient/page`
- `GET /admin-api/pay/profit-recipient/list-by-shop`
- `PUT /admin-api/store/shop/bind-profit-recipient`
- `GET /admin-api/pay/profit-sharing-order/page`
- `GET /admin-api/pay/profit-sharing-order/get`
- `POST /admin-api/pay/profit-sharing-order/retry`

## 新增内部 API

- `ProfitSharingOrderApi.createSharingOrder(dto)`
- `ProfitRecipientApi.listByShop(shopId)` / `getActiveRecipient(tenantId, role)` / `getRecipient(id)`
- `StoreRevenueApi.batchCreateStoreRevenue(list)`
- `StoreShopApi.isProfitRecipientBound(recipientId)`

## 关键实现

- 支付时若店铺启用分账，设置 `pay_mode=delay`，并提前校验收款人配置，缺失则拒绝支付。
- 支付成功回调透传 `adapay_payment_id`，创建分账挂起记录。
- `ProfitSharingSettlementJob` 每日 00:05 触发，调用 Adapay `PaymentConfirm.create` 执行分账。
- 分账失败自动回退到现有 `RevenueJob` 虚拟余额结算。

## 测试覆盖

- Admin E2E 测试：`admin/e2e/adapay-profit-sharing.spec.ts`
- 后端编译通过（`mvn compile -DskipTests`）
- 前端构建通过（`pnpm run build:local`）

## 已知技术债务

- `yshop-module-order-biz` 和 `yshop-module-store-biz` 的 `pom.xml` 仍保留对 `yshop-module-pay-biz` 的直接依赖（旧代码 `StoreWithdrawalServiceImpl` 等依赖 pay-biz 具体类）。本次新增代码已通过 `-api` 模块调用，旧依赖未清理。
- OpenAPI 快照当前从静态文件收集；服务运行后 `/v3/api-docs` 暂未包含新增接口，待排查 SpringDoc 扫描问题。

## Review 结论

**PASS_WITH_NOTES**

主要问题已在本次提交中修复：
- 收款人删除前校验绑定状态
- 支付前拒绝缺少分账配置的订单
- 结算 Job 复用 Service 执行逻辑
- 金额格式化、错误码统一、日志租户 ID 等

剩余未处理问题：
- 旧 `-biz` 模块之间的直接依赖
- 后端单元/集成测试补充

## 分支信息

| 仓库 | 功能分支 | 目标分支 |
|------|----------|----------|
| `backend/` | `feat/adapay-profit-sharing` | `master` |
| `admin/` | `feat/adapay-profit-sharing` | `master` |

## PR 内容要求

PR description 需嵌入以下文档内容：
- `governance/feature-docs/adapay-profit-sharing/requirements-spec.md`
- `governance/feature-docs/adapay-profit-sharing/technical-design.md`
- `governance/feature-docs/adapay-profit-sharing/contract-changes.md`
- `governance/ADR/adr-002-adapay-profit-sharing.md`
- `governance/feature-docs/adapay-profit-sharing/review-report.md`
