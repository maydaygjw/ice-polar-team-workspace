# OpenAPI AdaPay 结算与对账技术设计

## 模块影响

| 模块 | 变化 |
|---|---|
| Store API / Store Biz | 商圈增加 OpenAPI 默认店铺；按商圈代码查询时向 Pay 返回该配置。 |
| Pay API / Pay Biz | OpenAPI 支付请求接收商圈代码；支付成功生成通用应收应付；增加客户端主动结算；退款与结算互斥；扩展 AdaPay 本地对账数据源。 |
| Admin | 商圈表单选择并展示本商圈 OpenAPI 默认店铺。 |
| Database | `business_region` 增加默认店铺 ID；OpenAPI 支付单保存业务归属和计费快照。 |

不改微信支付渠道、不创建商城订单，不修改已完成的微信/商城支付流程。

## 关键决策

### 默认店铺与计费上下文

- 在 `business_region` 保存 `open_api_default_shop_id`，Admin 只允许选择归属同一商圈且启用的店铺。商圈代码查询通过现有 `BusinessRegionQueryApi` 扩展 DTO 返回该 ID，Pay 再以现有 `StoreShopQueryApi` 校验店铺状态、租户和商圈归属。
- 只在 OpenAPI 支付创建时解析一次商圈、默认店铺、模板和收款人配置。按请求金额构造无优惠、无平台补贴的计费上下文；模板含 `ORDER_ATTRIBUTE` 时，创建前拒绝，因 OpenAPI 不提供商城订单属性。
- 将解析后的计费输入和必要的模板/收款人快照保存在 OpenAPI 支付单。支付成功时以该快照幂等写入现有应收应付主记录、明细和分账主体；失败支付不生成应收应付。
- 所有结算事实的内部订单键使用 `paymentId`；`clientOrderNo` 作为外部业务引用。不得依赖或伪造 `yshop_store_order` 行。

### 共享计费和结算

- 抽取或扩展现有计费入口，使商城订单和 OpenAPI 支付都进入同一模板计算及快照落库逻辑；输入使用 pay 域的通用计费上下文，不让 `BillingSettlementApi` 依赖 OpenAPI Controller 类型。
- OpenAPI 的支付成功消费者调用该入口。`POST /open-api/v1/payments/by-client-order/{clientOrderNo}/settle` 按当前租户及 client 找到支付单，幂等补写缺失计费事实后复用既有 `settle(receivablePayableOrderId)`。
- 既有每日 00:05 `ProfitSharingSettlementJob` 继续工作；待处理查询新增 OpenAPI AdaPay 源并校验支付成功、退款状态为 NOT_REFUNDED 或 FAILED，且分账记录不存在。
- 客户端主动结算、日终任务、退款入口按 `tenantId + paymentId` 串行化；已有 PROCESSING/SUCCESS 分账不重复发起，结果未知时必须先查状态或等待对账。

### 退款与分账

- OpenAPI AdaPay 退款前读取支付锁和最新分账状态；PROCESSING/SUCCESS 分账拒绝退款。开始退款后结算入口发现 refund PROCESSING 即拒绝执行。
- 退款成功后将未结算应收应付标为 CANCELLED，保留历史明细；退款失败后保留原应收应付并恢复结算资格。退款与结算的状态判断须使用 OpenAPI 订单的 refund status，不查询商城订单。
- 本期不支持分账成功后的 `profitSharingReverse`，遵循 ADR-004。对账退款账单仍按既有 AdaPay 对账范围暂不处理。

### AdaPay 对账

- 现有 `selectAdapayPaymentsForReconciliation` 为商城订单内连接。改为从商城支付和 OpenAPI AdaPay 支付两种本地数据源汇总，OpenAPI 侧按 `pay_out_order_no.biz_type=open_api`、成功支付状态、Adapay payment ID 和 OpenAPI `paid_time` 入账。
- 支付交易使用 `adapay_payment_id` 匹配；成功分账仍从 `profit_sharing_order` 与 item 查询，按现有 `payment_id + confirm_id + recipient MemberId` 匹配。
- 对账 app_id 过滤、账单下载、差异分类、重跑版本和调度继续复用现有实现。微信账单对账、AdaPay Refund/RefundDiv 对账不在本期。

## 数据与迁移

- 在 `business_region` 新增可空 `open_api_default_shop_id`，历史商圈保持未配置，避免自动选错店铺。
- `pay_open_api_order` 增加商圈 ID/代码快照、店铺 ID/名称快照及计费快照 JSON；现有支付 ID 和 client order 唯一约束保持不变。
- 新增迁移只加字段和查询索引，不回填默认店铺，不改历史支付、计费或分账事实。回滚时先停止新 OpenAPI 结算入口，再保留/归档已产生的应收应付；不可物理删除已引用快照的数据。

## 风险与控制

- 默认店铺不存在、停用或跨商圈时在创建支付前拒绝，防止已收款后才发现无法计费。
- 计费快照保存前校验模板行、收款人有效性和金额合计；系统金额精确到分，剩余差额遵循现有计费计算规则。
- webhook 重复投递和客户端重试通过现有支付单幂等键及 `paymentId` 唯一应收应付记录去重。
- 退款和结算的互斥必须覆盖并发请求，不能只依赖接口层的先查后改。
- 迁移新增列可空，旧客户端创建支付的行为应通过契约版本/必填校验明确切换；此功能未给旧请求继续创建不带商圈的 AdaPay 支付保留默认店铺猜测。
