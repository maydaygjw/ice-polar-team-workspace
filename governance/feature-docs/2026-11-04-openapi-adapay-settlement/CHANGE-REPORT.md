# OpenAPI AdaPay 结算与对账

## 业务结果

- 商圈管理员可配置 OpenAPI 默认店铺；OpenAPI 创建请求传商圈代码，由服务端解析店铺。
- AdaPay 支付按创建时保存的计费和收款人快照生成应收应付；客户端可按自己的 `clientOrderNo` 主动结算，现有每日自动结算继续处理待结算记录。
- AdaPay OpenAPI 成功支付纳入现有日终对账。本期不新增微信账单对账。
- 退款与分账互斥：退款处理中阻止结算，退款失败恢复资格，退款成功将未结算应收应付标为 `CANCELLED`。

## 影响仓库

- `backend`：商圈配置 API/VO、OpenAPI 支付快照、应收应付与 AdaPay 结算/对账、退款互斥及迁移 SQL。
- `admin`：商圈默认店铺配置、财务应收应付退款作废状态展示。

## 契约与迁移

- API 创建支付新增 `businessRegionCode`；新增按 `clientOrderNo` 主动结算 API，沿用 `payment` scope。
- 迁移：`sql/migrations/V2026110401__openapi_adapay_settlement.sql`。
- 契约详见 `contract-changes.md`。

## 验证结果

- pay-biz Maven 测试：通过，45 项。
- store-biz Maven 测试：通过，8 项。
- Admin `pnpm build:prod`：通过。
- Admin `pnpm ts:check`：被全仓已有全局声明/类型错误阻断。
- AdaPay E2E 与数据库迁移演练：未执行，需在 dev 环境完成。

## 残余风险

- 真实 AdaPay 支付、退款回调和并发结算尚未在沙箱验证。
- Admin 全仓类型检查需另行治理；本次生产构建成功。

## 建议 PR

- 标题：`feat(openapi): 增加 AdaPay 主动结算和对账支持`
- 描述：按商圈配置 OpenAPI 默认店铺；AdaPay 支付冻结计费快照并生成应收应付，支持客户端主动和系统自动结算；扩展支付对账，并保证退款与分账互斥。
