## Feature: Adapay 日终对账

### Scope

**In Scope**

本期实现两个独立对账口径：

#### 口径一：支付交易对账

1. 每日自动下载 Adapay **支付交易账单**（`Charge_20260711.csv`），解析支付流水数据。
2. 将账单中的支付交易与本地 `pay_out_order_no`（status=1）和 `yshop_store_order`（paid=1）逐笔核对。
3. 比较字段：`adapay_payment_id`、支付金额、支付状态、支付时间。
4. 对账结果持久化到本地数据库（汇总表 + 明细表），支持管理后台查询。

#### 口径二：分账确认对账

1. 每日自动下载 Adapay **支付确认账单**（`PaymentConfirm_20260711.csv`）和**分账流水账单**（`Div_20260711.csv`）。
2. 将账单中的分账确认记录与本地 `yshop_adapay_profit_sharing_order`（sharing_status=SUCCESS(2)）逐笔核对。
3. 比较字段：`adapay_confirm_id`、`adapay_payment_id`、确认金额、手续费金额、各收款人分账金额。
4. 分账流水账单（Div）每笔订单有 2 行（平台+店铺），对账时按 `adapay_payment_id` + `adapay_confirm_id` 汇总比较。

#### 共享能力

5. 支持按租户维度独立执行对账，每个租户独立下载账单、独立核对。
6. 分账结算 Job 完成后延迟执行对账（建议 02:00），确保 Adapay 账单已就绪。
7. 支持异步手动触发对账（管理后台提交任务，返回 runId，前端轮询状态）。
8. 基于 attempt 的版本化重跑，保留历史对账记录，满足审计要求。

**Out of Scope**

- 非 Adapay 支付渠道（微信、支付宝）的对账。
- 退款对账（本期退款账单 Refund 仅有 2 条，格式已记录，后续需求独立实现）。
- 对账差异的自动冲销/调账。
- 对账结果的导出功能（deferred）。

**Deferred**

- 退款对账。
- 对账结果 CSV/Excel 导出。
- 告警通知（短信/邮件/企微）。

---

### Use Cases

**UC-1: 系统每日自动执行支付交易对账**

- 角色：系统
- 目标：对前一天所有 Adapay 支付交易与 Adapay 支付账单逐笔核对。
- 主流程：
  1. 系统在每日 02:00 触发对账 Job。
  2. Job 遍历所有已配置 Adapay 支付信息的租户。
  3. 对每个租户，调用 Adapay SDK `downloadBill(yesterday, billType)` 下载支付交易账单（`Charge` 类型）。
  4. 解析账单 CSV（格式见 `sample-bills/Charge_20260711.csv`），提取每笔交易的支付 ID、金额、状态等字段。
  5. 查询本地昨天 Adapay 支付成功的记录（`pay_out_order_no.status=1` + `yshop_store_order.paid=1`，以支付成功时间为准）。
  6. 按 `adapay_payment_id` 关联比较。
  7. 写入对账汇总表和明细表，标记 `reconciliation_type=PAYMENT`。
  8. 对账完成后，汇总统计写入汇总表；如有差异，记录差异信息。
- 业务规则：
  - 对账日期范围：`[账单日 00:00:00 Asia/Shanghai, 次日 00:00:00)`。
  - 账单中 `交易状态=F` 的记录（支付失败）不参与对账。
  - 账单中未启用分账的支付（如 `app_80050b22` 测试商户）也纳入支付对账范围。

**UC-2: 系统每日自动执行分账确认对账**

- 角色：系统
- 目标：对前一天所有已分账成功的订单与 Adapay 分账确认账单 + 分账流水账单逐笔核对。
- 主流程：
  1. 与 UC-1 同一 Job 中顺序执行（支付对账 → 分账对账）。
  2. 下载支付确认账单（`PaymentConfirm` 类型）和分账流水账单（`Div` 类型）。
  3. 本地查询昨天分账成功的记录（`yshop_adapay_profit_sharing_order.sharing_status=SUCCESS(2)`，以 `sharing_time` 为准）。
  4. 支付确认账单按 `adapay_confirm_id` 关联本地 `adapay_confirm_id`。
  5. 分账流水账单按 `adapay_payment_id` + `adapay_confirm_id` 分组汇总后，与本地 `profit_sharing_order_item` 各角色金额汇总比较。
  6. 写入对账汇总表和明细表，标记 `reconciliation_type=PROFIT_SHARING`。
- 业务规则：
  - 日期筛选使用 `profit_sharing_order.sharing_time`（实际分账成功时间），而非 `create_time`。
  - 分账流水每笔订单有 ≥2 行（平台+至少一个店铺收款人），需要按 `adapay_payment_id` + `adapay_confirm_id` 分组汇总后与本地各角色明细之和比较。
  - 存在 PENDING/PROCESSING 状态的分账记录时，汇总 `reconciliation_result=INCOMPLETE`。

**UC-3: 管理员查看对账结果**

- 角色：财务/管理员
- 目标：查看每日对账结果，定位差异。
- 主流程：同原方案，新增按 reconciliation_type 筛选。
- 业务规则：
  - 租户管理员只看到自己租户的对账记录。
  - 平台财务可选择租户查看。
  - 列表页区分执行状态（execution_status）和对账结果（reconciliation_result）。

**UC-4: 管理员异步手动触发对账**

- 角色：财务/管理员
- 目标：对指定日期的数据进行重新对账，不阻塞管理后台。
- 主流程：
  1. 管理员在对账记录页面点击"重新对账"。
  2. 选择目标日期和对账类型（支付/分账/全部）。
  3. 系统创建异步执行任务，返回 `runId`。
  4. 前端轮询或刷新查看任务状态。
- 业务规则：
  - 每次执行新增一个 attempt，不删除历史记录。
  - 同一 `(tenant_id, bill_date, reconciliation_type)` 同时只允许一个运行中任务。
  - 重跑需填写重跑原因。

---

### Business Rules

1. **对账日期**：`Asia/Shanghai` 时区，统一 `[账单日 00:00:00, 次日 00:00:00)`。
2. **支付对账**：以本地支付成功时间为准，比较 `adapay_payment_id`、支付金额、支付状态。
3. **分账对账**：以 `sharing_time` 为准（非 `create_time`），比较 `adapay_confirm_id`、确认金额、各角色分账金额之和。
4. **金额比较**：所有金额解析后统一换算为整数分（`×100` 转 `long`），精确比较，任意一分钱差异均记录。
5. **手续费**：Adapay 手续费约 `交易金额 × 0.25%`，存在第三方特定舍入规则。手续费原始值保留，暂不参与金额匹配。
6. **幂等性**：同一 `(tenant_id, bill_date, reconciliation_type, attempt_no)` 唯一；每次重跑新增 attempt，不删除历史。
7. **并发控制**：数据库条件更新或分布式锁确保同一租户、日期和类型不并发执行。
8. **账单未生成**：账单下载返回"未生成"时标记 `execution_status=RETRYABLE_FAILED`，非 `FAILED`。
9. **退款/Fallback/非分账支付**：
   - 支付对账包含所有 Adapay 支付（含非分账支付）。
   - 分账对账仅包含 `sharing_status=SUCCESS` 的记录。
   - `FALLBACK` 记录单独标记，不参与分账金额核对。
   - 退款本期不参与对账（out of scope）。

---

### Frontend Requirements

（与 UI/UX 设计保持一致，见 `ui-ux-design.md`）

---

### Edge Cases

- Adapay 账单格式已通过真实账单确认（5 个 CSV 文件，`#` 开头为注释行，末尾含 `#合计` 行）。
- 若某租户前一天无任何 Adapay 支付，对账结果为空（总笔数 = 0），标记为 `BALANCED`。
- 若账单下载时 Adapay 返回"账单未生成"，应标记为 `RETRYABLE_FAILED`，下次对账可覆盖。
- 若 `adapay_payment_id` 在本地不存在（账单有本地无），标记为 `BILL_ONLY`。
- 若本地支付记录在账单中不存在（本地有账单无），标记为 `LOCAL_ONLY`。
- 分批支付（`outPayNo = orderId-{n}`）：仅最终支付成功的 `outPayNo`（`pay_out_order_no.status=1`）参与对账。
- 重复账单行：按 `adapay_payment_id` 去重，发现重复时记录到错误日志，不静默覆盖。
- 分账流水账单每订单多行，按 `(adapay_payment_id, adapay_confirm_id)` 分组汇总后比较。

---

### Acceptance Criteria

- [ ] 支付交易对账和分账确认对账作为两个独立口径执行，各自产出独立的对账汇总和明细。
- [ ] 支付对账关联 Key = `adapay_payment_id`，分账对账关联 Key = `adapay_confirm_id`。
- [ ] 金额精确到分比较，任意一分钱差异均记录为 `AMOUNT_DIFF`。
- [ ] 对账日期使用 `sharing_time`（分账）和支付成功时间（支付），非 `create_time`。
- [ ] 所有时间以 `Asia/Shanghai` 为准。
- [ ] 重跑新增 attempt，不删除历史记录；汇总页默认展示最新成功 attempt。
- [ ] 执行状态（execution_status）和对账结果（reconciliation_result）分开展示。
- [ ] 存在 PENDING/PROCESSING 分账记录时，结果标记为 `INCOMPLETE`。
- [ ] 账单下载失败不影响其他租户。
- [ ] 管理后台区分平台财务和租户管理员权限。
- [ ] 手动重跑为异步操作，返回 runId，前端轮询状态。

---

### Assumptions

1. Adapay 日终账单在 T+1 凌晨 02:00 前生成完毕（已确认：账单导出时间为 `2026年07月12日 02:06:34`，账单在 02:00-02:06 左右就绪）。
2. SDK `downloadBill` 实际可用性待技术验证确认（P0-2 已登记，blocked=true）。
3. 同一 `adapay_payment_id` 不会跨租户出现。
4. 对账数据量较小（每日每个租户数百笔），无需分批处理。
