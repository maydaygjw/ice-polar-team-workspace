# AdaPay 拼单多支付单结算技术设计

## 1. 总体架构

采用“订单级分账主记录 + 支付级分账子记录”模型：

```text
应收应付订单
  └─ 分账主记录（一订单一条，保存订单级汇总状态）
       ├─ 支付分账子记录（payment_id 1，confirm_id 1）
       │    └─ 分账明细
       └─ 支付分账子记录（payment_id 2，confirm_id 2）
            └─ 分账明细
```

普通订单继续兼容现有分账主记录路径；拼单订单为每个成功支付对象创建一个子记录，并分别调用 AdaPay 确认分账。

## 2. 数据模型

### 2.1 新增 `yshop_adapay_profit_sharing_payment`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | bigint | 主键 |
| `tenant_id` | bigint | 租户标识 |
| `sharing_order_id` | bigint | 分账主记录 ID |
| `pay_out_order_no_id` | bigint | `pay_out_order_no.id` |
| `adapay_payment_id` | varchar(64) | AdaPay 支付对象 ID |
| `group_member_no` | int | 拼单成员序号，普通订单为 1 |
| `pay_amount` | decimal(12,2) | 本支付对象实际支付金额 |
| `confirm_amount` | decimal(12,2) | 本次确认金额 |
| `adapay_confirm_id` | varchar(64) | AdaPay 确认对象 ID |
| `sharing_status` | tinyint | 待分账、处理中、成功、失败、已回退 |
| `fallback_revenue` | tinyint | 是否已回退到 Revenue |
| `sharing_time` | datetime | 成功确认时间 |
| `error_msg` | varchar(512) | 最近一次失败原因 |

唯一约束：`(tenant_id, adapay_payment_id)`；索引：`(tenant_id, sharing_order_id, sharing_status)`。

### 2.2 扩展分账明细

在 `yshop_adapay_profit_sharing_order_item` 增加 nullable `sharing_payment_id`：

- 普通历史记录为空，继续通过 `sharing_order_id` 读取。
- 拼单分账明细必须绑定对应支付分账子记录。
- 同一主体在不同支付对象中的金额和手续费承担方独立计算。

### 2.3 现有主记录

`yshop_adapay_profit_sharing_order` 继续作为订单级汇总和管理入口。拼单场景不再使用其中单值 `adapay_payment_id`、`adapay_confirm_id` 表示全部支付结果；这些字段仅兼容普通订单或作为首个/兼容展示值，真实明细以子表为准。

订单级状态聚合规则：

1. 全部子记录成功或合法回退：已结算。
2. 存在处理中：处理中。
3. 不存在处理中但存在失败：失败/部分失败。
4. 全部待分账：待分账。

## 3. 结算编排

### 3.1 创建分账任务

`BillingSettlementService` 先按订单生成完整的订单级主体金额，再查询所有成功的 AdaPay 支付记录：

1. 普通订单使用兼容路径，确认金额为订单可分账金额。
2. 拼单订单读取所有 `status=1` 且未退款的 `pay_out_order_no`。
3. 校验支付记录金额合计等于订单实际支付金额；不一致时进入失败/人工核查，不调用 AdaPay。
4. 按支付记录 `pay_amount / 支付总额` 将每个主体金额拆分到各支付对象。
5. 金额精确到分，最后一个支付对象吸收舍入差额。
6. 为每个支付对象创建唯一分账子记录和对应明细。

### 3.2 执行单个支付对象

每个子记录单独执行：

```text
读取子记录
  → 校验状态和 payment_id
  → 查询支付对象剩余额度（或使用已确认的本地剩余额度）
  → confirm_amount <= 剩余额度
  → 组装 div_members
  → 校验主体金额合计 == confirm_amount
  → 确保恰好一个 fee_flag=Y
  → 调用 PaymentConfirm
  → 保存 confirm_id 和子记录状态
  → 聚合更新主记录
```

确认单号使用子记录 ID 生成，保证重试时不复用已提交的确认单号。外部调用与本地事务之间采用状态机和对账补偿保证最终一致，不以数据库事务假设外部调用可回滚。

### 3.3 重试与并发

- 子记录成功后禁止重试。
- 处理中子记录不得直接重复提交；先通过 AdaPay 查询/日终对账确认结果。
- 失败子记录使用行锁或条件更新抢占执行权，避免人工按钮、日终任务和 Redis 重发并发调用。
- 主记录只负责聚合，不重复触发已成功子记录。
- 子记录失败且未回退时允许重试；回退后禁止重试。

## 4. 手续费承担方

主体拆分后，对每个支付对象单独处理手续费承担方：

1. 原配置承担方金额大于 0：保留 `fee_flag=Y`。
2. 原配置承担方金额等于 0：按模板顺序选择当前支付对象中第一个金额大于 0 的其他主体。
3. 没有可用主体：子记录标记失败并记录明确错误，不调用 AdaPay。
4. 最终每个 AdaPay 请求必须恰好一个 `fee_flag=Y`。

## 5. 订单结算管理

查询按订单聚合主记录，不再通过“最新一条分账记录”判断订单状态。订单详情增加支付分账子记录列表，包含支付金额、确认金额、支付对象、确认对象、状态、失败原因及主体明细。

重试操作定位到子记录 ID；回退操作只作用于失败且未回退的子记录。页面仍按业务订单展示，避免一个拼单订单出现多行订单。

## 6. 日终对账

### Phase 1：支付对账

`PayOutOrderNoMapper.selectAdapayPaymentsForReconciliation` 使用：

```sql
COALESCE(pno.pay_amount, o.pay_price)
```

普通历史支付兼容订单金额；拼单支付使用每笔实际支付金额。

### Phase 2：确认分账对账

本地记录按 `adapay_payment_id` 分组，按 `adapay_confirm_id` 匹配 AdaPay `PaymentConfirm`。一个订单允许出现多个确认记录。

### Phase 3：主体金额对账

以 `payment_id + confirm_id + member_id` 为唯一维度，比较每个支付对象下的主体金额。手续费承担方只用于展示，不参与金额匹配。

日终汇总金额按 `payment_id` 去重，不能将 Charge、PaymentConfirm、Div 三类账单金额重复相加。

## 7. 退款与回退

- 未分账的拼单订单：按所有成功支付记录逐笔关闭/退款。
- 任一子记录已成功分账时，沿用现有“分账后禁止退款”规则，除非后续单独实现分账回退。
- 分账失败回退时只回退失败子记录对应的主体金额，不重复处理成功子记录。
- 退款、支付撤销和回退均以 `pay_out_order_no` 与分账子记录为数据源，不读取主订单单一交易号。

## 8. 迁移与回滚

新增日期脚本：`backend/sql/upgrade-2026-09-02-adapay-group-payment-settlement.sql`。

迁移内容：

- 创建支付分账子记录表。
- 为分账明细增加 `sharing_payment_id` 和索引。
- 不回填、不修改历史财务金额。

回滚要求：

- 先停止新代码写入并确认没有新拼单分账子记录。
- 保留新增字段和表，优先通过应用回滚兼容历史记录。
- 不直接删除承载财务历史的子表；如确需删除，必须先导出审计数据并获得单独授权。

## 9. 模块影响与验证

- `backend/pay`：分账子记录、拆分算法、状态机、结算和对账。
- `backend/order`：多支付退款/撤销及订单结算状态聚合。
- `admin`：订单结算管理详情、子记录重试和日终对账筛选展示。
- `miniapp`：N/A，本期不改用户端。

必须覆盖普通订单、两笔等额拼单、非等额拼单、部分成功、处理中、手续费承担方为 0、重复消息、退款和对账重跑。
