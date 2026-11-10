# 契约变更 — 店铺收入报表独立数据源与打款指标

## API

### 汇总分页

`GET /admin-api/pay/profit-sharing-income/summary-page`

- 权限：`pay:profit-sharing-income:query`（不变）。
- 请求：沿用分页参数、`shopId`、`settlementDateStart`、`settlementDateEnd`，新增 `periodType`（`DAY`、`WEEK`、`MONTH`，缺省为 `DAY`）和可选 `shopIds` 多店铺筛选；日期两端包含。传入非空 `shopIds` 时仅返回所选店铺，且与当前用户可访问店铺范围取交集；省略或传空集合表示不过滤所选店铺。原 `shopId` 单店参数继续兼容。
- 汇总行粒度为 `settlementDate + shopId + recipientId`，因此一个日期和店铺可返回多行。店铺级订单数、订单金额、收入、预计打款收入和预计打款笔数只在主收款人行返回；非主收款人行对应字段为 0。`paymentAmount` 是该收款人在当前店铺绑定范围内的净到账展示金额。`storePaymentAmount` 为同店铺同日所有非共享收款人净到账总额，仅用于主收款人行的店铺级打款金额核对。
- 本地同步筛选该店铺当前主绑定和有效对账绑定（`binding_purpose=RECONCILIATION` 且 `mark_status=VALID`）；无效对账关系不纳入。同步只重建本地已采集结算明细，不请求 AdaPay。共享目标按租户、收款人、Member ID 和结算账户识别；若同一目标绑定多个不同店铺，则把完整净到账金额展示在每一家当前有效绑定店铺的对应收款人行，并通过 `sharedPaymentAmount` 标记共享金额。该金额不按店铺拆分，不计入 `storePaymentAmount`，跨店铺相加会重复统计；管理端须在金额旁显示「(共享)」。
- 响应既有字段保持不变，新增：

| 字段 | 类型 | 说明 |
|---|---|---|
| `estimatedPaymentIncome` | `decimal` | 预计打款日期归属当日的店铺角色金额合计 |
| `estimatedPaymentCount` | `long` | 对应预计打款订单数，按订单去重 |
| `paymentAmount` | `decimal` | 当前收款人成功流水净到账金额合计 |
| `sharedPaymentAmount` | `decimal` | 当前收款人共享目标净到账金额；展示在每个当前绑定店铺，跨店重复，单店核对不计入 |
| `periodEndDate` | `date` | 周期结束日期；周/月视图分别为周日/月末，日视图与 `settlementDate` 相同 |
| `nonWorkingDayLabel` | `string \| null` | 日视图按中国结算日历返回非工作日标识；周/月视图中周期包含非工作日时返回「含休息日」，否则为 `null` |
| `recipientId` | `long` | 当前行收款人 ID；无主绑定的店铺级指标行使用 `0` |
| `recipientName` | `string` | 收款人名称快照 |
| `isPrimaryRecipient` | `boolean` | 当前行为主收款人行或店铺指标承载行；店铺级指标和金额核对只在该行展示 |
| `memberIdLast4` | `string \| null` | 收款人 MemberId 后四位；接口不返回完整 MemberId |
| `bankCardLast4` | `string \| null` | 收款人银行卡后四位；接口不返回完整银行卡号 |
| `storePaymentAmount` | `decimal` | 同店铺同日期全部非共享收款人的净到账总额；仅用于主行金额核对 |

`settlementDate` 和 `periodEndDate` 在周/月视图分别表示完整自然周或自然月的首日和末日。日期筛选两端包含，周/月视图会将命中的首尾周期扩展至完整自然周或自然月后查询和聚合；店铺周期内某些日期没有日报数据，不影响周期仍显示完整日期范围。汇总数值字段按日投影相加，分页发生在周期聚合之后。

管理后台在日期旁展示非空 `nonWorkingDayLabel`。新增综合费率列，由主收款人行的 `incomeAmount / orderAmount` 计算，订单金额为 0 时显示 `—`。新增「打款金额核对」列，仅在主行按分比较 `estimatedPaymentIncome` 与 `storePaymentAmount`：相同显示一致图标，不同显示不一致图标；两项均为 0 时视为一致。

管理后台每位收款人单独一行，展示收款人姓名、银行卡后四位和 MemberId 后四位。订单及预测指标只显示在主收款人行；打款金额按收款人显示。`sharedPaymentAmount > 0` 时在该收款人的打款金额旁显示「(共享)」。共享目标的完整净到账金额展示在每一家当前绑定店铺，因此跨店铺求和不代表实际收款总额。金额核对只在主行按非共享到账总额比较。接口不返回完整银行卡号或完整 MemberId。

查询只读 `yshop_pay_store_income_report_daily`，按 `tenant_id`、可访问店铺和日期筛选；按日期倒序、店铺 ID 升序、主收款人优先分页。旧客户端忽略新增字段即可保持兼容。

### 分页明细

`GET /admin-api/pay/profit-sharing-income/detail-page`

- URL、权限和请求/响应结构不变。
- 继续读取本地分账事实和订单表，按店铺、分账日期分页；不调用 AdaPay。原 `settlementDate` 单日请求保持兼容；可同时提供 `settlementDateStart`、`settlementDateEnd` 按闭区间查周/月明细。
- 此明细仅对应原有 Adapay 分账订单收入，不包含没有订单关系的实际打款流水。

### 手工同步

`POST /admin-api/pay/profit-sharing-income/sync`

- 权限：复用现有 `pay:profit-sharing-income:query`；不新增权限点。同步只重建本地可再生的报表投影，不更新订单、分账或收款人结算事实。
- 请求：

```json
{
  "shopId": 123,
  "settlementDateStart": "2026-10-01",
  "settlementDateEnd": "2026-10-31"
}
```

- 必填：`shopId`、`settlementDateStart`、`settlementDateEnd`；结束日期不得早于开始日期。只支持单店铺和闭区间自然日。
- 服务端校验当前租户及调用人的店铺范围；越权目标拒绝执行，不返回部分数据。
- 成功响应包含 `shopId`、`settlementDateStart`、`settlementDateEnd`、`rebuiltRowCount` 和 `unassignedPayoutRecordCount`。最后一项是该租户、该期间成功但没有 `shop_id` 的店铺级打款流水数；仅对可访问全租户店铺的管理员返回实际数量，受限店铺用户返回 0，避免泄露其他店铺数据。接口同步执行，返回成功表示事务已提交。
- 错误语义：参数非法使用统一参数校验错误；店铺不存在或无权限返回权限/资源错误；同店铺同步锁冲突返回可重试冲突错误；源查询或写入失败回滚并返回统一服务错误。
- 重复请求幂等；每次都从现有本地源数据重算所选范围，不产生累计副作用。不访问远端系统。

## DB

### 新表：`yshop_pay_store_income_report_daily`

此表保存可重建的报表日聚合，不是订单或结算原始财务事实。列定义：

| 字段 | 类型 | 约束/说明 |
|---|---|---|
| `id` | `BIGINT` | 主键，自增 |
| `tenant_id` | `BIGINT` | 非空，租户隔离 |
| `shop_id` | `BIGINT` | 非空，店铺维度 |
| `recipient_id` | `BIGINT` | 非空，收款人维度；无主绑定且需要承载店铺指标时使用 `0` |
| `recipient_name` | `VARCHAR(100)` | 非空，收款人名称快照 |
| `is_primary_recipient` | `TINYINT` | 非空，默认 `0`；主行或店铺指标承载行标记为 `1` |
| `member_id_last4` | `VARCHAR(4)` | 可空，仅保存 MemberId 后四位 |
| `bank_card_last4` | `VARCHAR(4)` | 可空，仅保存银行卡后四位 |
| `shop_name` | `VARCHAR(100)` | 非空；优先使用分账、订单、结算明细中的可用名称快照，均缺失时回退为 `店铺 {shopId}` |
| `report_date` | `DATE` | 非空；订单、预测、打款指标各自按业务日期归属到的自然日 |
| `settlement_order_count` | `BIGINT` | 非空，默认 0；原有成功分账订单数 |
| `order_amount` | `DECIMAL(14,2)` | 非空，默认 0；原有关联订单实付金额 |
| `income_amount` | `DECIMAL(14,2)` | 非空，默认 0；原有店铺角色分账收入 |
| `estimated_payment_income` | `DECIMAL(14,2)` | 非空，默认 0；预计打款店铺收入 |
| `estimated_payment_count` | `BIGINT` | 非空，默认 0；预计打款订单笔数 |
| `payment_amount` | `DECIMAL(14,2)` | 非空，默认 0；实际成功净到账金额 |
| `shared_payment_amount` | `DECIMAL(14,2)` | 非空，默认 0；`payment_amount` 中属于多店共享目标的金额子集 |
| `store_payment_amount` | `DECIMAL(14,2)` | 非空，默认 0；非共享收款人店铺当日净到账总额，仅主行用于核对 |
| `creator` / `updater` | `VARCHAR(64)` | 审计用户 |
| `create_time` / `update_time` | `DATETIME` | 创建和最近重建时间 |

表使用 InnoDB、`utf8mb4`、`utf8mb4_0900_ai_ci`。唯一键 `uk_tenant_shop_date_recipient (tenant_id, shop_id, report_date, recipient_id)`；范围查询索引 `idx_tenant_date_shop (tenant_id, report_date, shop_id)`。该投影表不使用逻辑删除：所选范围的旧聚合在同一事务中物理删除并重建，失败会回滚。

### 源表

- 复用 `yshop_adapay_profit_sharing_order`、`yshop_adapay_profit_sharing_order_item`、`yshop_store_order` 和 `yshop_pay_receivable_payable_order` 计算原有分账收入、预测金额及笔数。
- 复用 `yshop_adapay_profit_recipient_settlement_detail` 计算实际到账；过滤 `recipient_type=2`（`SHOP_RECIPIENT`）、`settle_stat=succeeded`、`is_active_version=1`、`deleted=0`，并只纳入当前主绑定及 `mark_status=VALID` 的对账绑定，按收款人汇总 `net_settle_amount`。
- 不修改源表，不更改源表历史数据。

### 迁移与回滚

- 使用 `V2026111002__store_income_report_recipient_rows.sql` 扩展既有投影表和唯一键，并新增 `V2026111003__store_income_report_shared_payment_amount.sql` 保存共享金额子集；已执行的迁移不可修改。不新增权限数据。
- 回滚代码时移除新增按钮权限及 API/页面；投影表可随回滚删除。投影数据可从本地源表重新生成，不含不可恢复的财务事实。
- 不修改已经执行的 Flyway migration，不修改基线 SQL。

## 权限与数据范围

| 权限 | 语义 |
|---|---|
| `pay:profit-sharing-income:query` | 现有权限，查询汇总、分账明细并按店铺和期间重算本地报表投影 |

所有接口均限制当前租户；应用服务沿用现有 `getAccessibleShopIds()` 店铺范围规则。租户管理员/超级管理员可同步当前租户任一店铺；普通用户只能查询和同步其授权店铺。同步必须校验传入 `shopId`，不能依赖前端隐藏按钮。

## 依赖与外部系统

- 无新增权限依赖、MQ 或外部系统。
- 复用项目已有 Redisson、`ProfitSharingSettlementDateCalculator` 和本地结算日历。
- 同步、列表、订单明细均不得调用 AdaPay；收款人结算的既有本地采集任务不在本契约范围内。
