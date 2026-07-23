# 商圈排名竞价（二期）— Change Report

## 业务结果

- 生成当前竞价周期，支持商家按门店首次出价、同档位加价、预付和尾款支付。
- 一个周期内一个门店只能保留一张出价单；后续只能在首次档位加价。
- 到期后按最终出价和尾款支付时间简单结算，写入 store 模块通用门店排序结果。
- 提供 app 出价/支付/我的出价单接口，以及 admin 出价单和结算结果只读查询页面。

## 影响仓库

- `backend`：bidrank 周期、出价单、支付通知、结算任务、store/pay API 扩展和 SQL 升级脚本。
- `admin`：出价单分页查询、结算结果查询 API 与只读页面。
- `governance`：阶段 2 规格、契约、UI、测试、评审和变更记录。

## 契约与迁移

- 新增 `StoreShopQueryApi.isShopAdmin`，补充出价权限校验。
- 新增 pay API 的竞价支付/退款 DTO 和 `bizType` 分流；竞价支付通知由 bidrank 消费。
- 新增 `yshop_bid_auction_cycle`；扩展 `yshop_bid_order` 周期、支付状态字段及 `cycle + store` 唯一约束；扩展 `pay_out_order_no.biz_type`。
- 新增 admin 出价单、结算结果菜单和 `bidrank:order:query` 权限。
- 迁移脚本已与一期合并为：`backend/sql/upgrade-2026-07-22-bidrank-auction.sql`。

## 验证结果

- 后端完整 reactor compile：通过。
- bidrank 目标单测：通过，11 tests。
- admin `pnpm build:prod`：通过。
- `git diff --check`：通过。
- 全量 Maven test：被既有 `DesensitizeTest` 失败阻断。
- admin `pnpm ts:check`：被既有类型声明缺失阻断。
- 真实支付沙箱与浏览器 E2E：未执行，需外部环境和测试数据。

## 残余风险

并发竞价、重复请求/重复回调、可重入结算、退款重试对账、实时最低入围价和价格栈均明确留到 Phase3。

## 建议 PR

标题：`feat(bidrank): implement phase2 auction bidding and settlement`

描述：

```markdown
## Summary
- 实现竞价周期、单门店单周期出价、同档位加价、预付/尾款和简单结算
- 将中标结果写入 store 通用排序接口
- 增加 admin 出价单与结算结果只读查询

## Repositories
- backend
- admin
- governance

## Verification
- backend compile passed
- bidrank target tests passed: 11
- admin production build passed
- full Maven test and admin type check have unrelated baseline failures

## Risks
- concurrency, idempotency, refund retry/reconciliation and payment sandbox E2E are Phase3 items
```
