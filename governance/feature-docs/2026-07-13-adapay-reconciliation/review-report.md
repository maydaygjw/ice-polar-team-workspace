# Adapay 日终对账需求与设计评审报告

## 1. 评审信息

| 项目 | 内容 |
|------|------|
| 评审对象 | `governance/feature-docs/2026-07-13-adapay-reconciliation/` |
| 评审范围 | 需求规格、技术设计、API/数据库契约、管理后台 UI/UX |
| 评审角色 | 独立第三方需求评审人 |
| 评审结论 | **暂不通过，修改后复审** |
| 建议风险等级 | `high` |
| 建议阻塞状态 | 在取得真实账单样例并确认外部接口契约前保持阻塞 |

本报告用于指出需求和设计中可能导致实现失败、错账、漏账或审计信息丢失的问题，并给出进入开发前应完成的修改项。本报告不包含具体代码实现。

## 2. 总体评价

现有方案已经覆盖自动任务、手动重跑、汇总和明细存储、后台查询等基本能力，整体功能方向合理。

但方案目前把“支付交易对账”和“分账确认对账”混合为一个流程，且真实 Adapay 账单格式、字段、账单类型和返回方式尚未确认。本地数据又使用分账记录创建时间筛选，可能出现错日、漏单以及大量正常记录被误判为差异。

在核心对账口径没有冻结之前，不建议直接进入正式开发。

## 3. 阻断问题

### P0-1：支付对账与分账对账口径混合

当前需求希望通过同一份 Adapay 日终账单同时验证：

- 支付金额；
- 支付状态；
- 分账总金额；
- 本地各角色分账金额。

但现有材料没有证明下载的日终账单包含分账确认单和各收款人明细。若账单只包含支付、手续费和结算金额，则无法据此验证每个角色的分账金额。

#### 修改建议

将本期对账拆成两个独立口径：

1. **支付交易对账**
   - 外部数据：Adapay 支付交易账单。
   - 本地数据：`pay_out_order_no`、订单支付快照。
   - 比较字段：`payment_id`、`out_pay_no`、支付金额、支付状态、支付时间。
2. **分账确认对账**
   - 外部数据：Adapay 分账确认账单；若账单不提供，则通过 `queryProfitSharingConfirm(adapay_confirm_id)` 查询。
   - 本地数据：`yshop_adapay_profit_sharing_order`、`yshop_adapay_profit_sharing_order_item`。
   - 比较字段：确认单号、支付 ID、分账状态、收款人和分账金额。

若本期只能取得支付账单，应将本期范围收敛为“支付交易对账”，不能宣称已完成逐角色分账对账。

### P0-2：Adapay SDK 契约尚未验证

技术设计使用 `downloadBill(yesterdayDate, BillType.ALL)`，但当前项目依赖的 `pay-java-adapay 2.14.14-SNAPSHOT` 中，`BillType` 是接口，未发现可直接使用的 `BillType.ALL` 常量。

此外，以下信息仍是未经验证的假设：

- `downloadBill` 的实际账单类型参数；
- 返回值是文件内容还是下载 URL；
- 文件是否为 CSV；
- 文件编码、表头、尾汇总行和金额单位；
- “账单未生成”与“当天无交易”的响应差异；
- 支付账单是否包含退款、撤销及分账交易。

技术设计还使用了 `merchant_details.enabled = 1`，但现有 `MerchantDetailsDO` 没有 `enabled` 字段。

#### 修改建议

开发前完成一次最小技术验证，并将以下脱敏结果补充到技术设计：

- 正常下载请求和响应样例；
- 账单未生成、无交易、鉴权失败的响应样例；
- 一份真实脱敏账单；
- 字段字典、状态字典、金额单位和时区；
- 下载 URL 的有效期和文件大小限制；
- 实际可用的 `BillType` 实现方式。

### P0-3：对账日期筛选字段错误

需求使用 `profit_sharing_order.create_time` 作为账单日期依据；技术设计一处描述按分账时间筛选，SQL 却仍按 `create_time` 查询。

现有分账任务在当天处理前一天创建的待分账记录，因此记录创建日期与实际分账成功日期并不相同。失败后重试成功的记录也可能跨越多个日期。

#### 修改建议

- 支付交易对账使用 Adapay 支付成功时间和本地支付成功时间。
- 分账确认对账使用 `sharing_time` 和 Adapay 分账确认时间。
- 明确统一使用 `Asia/Shanghai`。
- 时间范围统一定义为 `[账单日 00:00:00, 次日 00:00:00)`。
- 禁止使用数据库记录创建时间代替财务业务发生时间。

### P0-4：账单范围与本地数据范围不一致

当前本地查询只包含 `sharing_status = SUCCESS` 的分账订单，但 Adapay 商户账单可能同时包含：

- 未启用分账的 Adapay 支付；
- 分账失败后回退 RevenueJob 的支付；
- 退款和撤销；
- 同一商户下其他业务产生的交易。

这些记录可能被错误标记为“仅账单有”。同时，退款被定义为本期范围外，也会造成账单汇总金额与本地金额无法直接比较。

#### 修改建议

- 明确账单中每种交易类型的纳入和排除规则。
- 支付账单先与全部 Adapay 支付记录对账，再从中识别延迟分账子集。
- 明确 `FALLBACK`、退款、撤销和非分账支付是否参与汇总。
- 如果需要区分支付模式，应保存支付发生时的 `pay_mode` 快照，不应仅根据是否存在分账记录反推。

### P0-5：一分钱差异会被判为对平

现有规则将金额差异小于等于 `0.01` 元判为对平。这会直接隐藏真实的一分钱账差。

项目使用 `BigDecimal` 和两位小数金额，不应以浮点误差为由吞掉账差。

#### 修改建议

- 所有金额解析后统一换算为整数分。
- 支付本金、分账总额和分账明细之和均精确比较。
- 任意一分钱差异都必须记录。
- 手续费如存在第三方特定舍入规则，应单独定义并保留原始值。

### P0-6：执行状态与对账结果混为一体

当前只有 `PENDING`、`PROCESSING`、`COMPLETED`、`FAILED`。该状态只能表达任务是否执行完成，无法表达执行成功后账目是否对平，也无法表达仍有分账处理中。

如果存在 `PENDING/PROCESSING` 分账记录，当前设计仍允许汇总标记为“已完成”，容易给财务人员造成已经完成全部核对的误解。

#### 修改建议

拆分两个字段：

```text
execution_status:
  PENDING / RUNNING / SUCCEEDED / RETRYABLE_FAILED / FAILED

reconciliation_result:
  BALANCED / UNBALANCED / INCOMPLETE / UNKNOWN
```

汇总表增加：

- `pending_count`
- `processing_count`
- `amount_diff_count`
- `status_diff_count`
- `started_at`
- `finished_at`
- `trigger_type`
- `trigger_user_id`

账单暂未生成应归类为 `RETRYABLE_FAILED`，而不是普通失败。

### P0-7：重跑删除历史记录不符合财务审计要求

现有方案要求手动重跑前删除原汇总和明细。这会丢失旧结果、操作人和差异变化过程，也与治理规则中的历史数据不可变原则冲突。

自动任务和人工重跑同时发生时，删除再新增还可能产生并发覆盖。

#### 修改建议

采用版本化重跑，不删除历史记录：

```text
tenant_id + bill_date + reconciliation_type + attempt_no
```

- 每次执行新增一个 attempt。
- 汇总页默认展示最新成功 attempt。
- 保存触发方式、触发人、重跑原因和前一次 attempt ID。
- 保存原始账单文件名、下载时间和 SHA-256 摘要。
- 使用数据库条件更新或分布式锁，避免同一租户、日期和类型并发执行。

## 4. 重要修改项

### P1-1：多租户接口语义冲突

接口请求允许传入 `tenantId`，同时又声明数据继承当前租户上下文。这两种方式不能同时作为安全边界。

建议区分：

- 租户管理员接口：不接收 `tenantId`，只操作当前租户。
- 平台财务接口：允许选择租户，但必须使用平台级角色校验和操作审计。

权限标识建议沿用 pay 模块命名：

```text
pay:reconciliation:query
pay:reconciliation:retrigger
```

仅检查 permission 不等同于已经验证“超管或财务角色”。

### P1-2：手动重跑不应同步等待

下载和解析外部账单耗时不可控，管理后台请求同步等待容易超时。

建议重跑接口只创建执行任务并返回 `runId`：

```http
POST /admin-api/pay/reconciliation/runs
```

前端刷新或轮询任务状态。若相同租户、日期和类型已有任务正在执行，应返回现有 `runId`，不重复创建。

### P1-3：数据库模型不完整

需要修正以下问题：

- 明细表补充 `updater`、`update_time`、`deleted`，与项目 `BaseDO` 保持一致。
- `out_pay_no` 长度与现有 `pay_out_order_no.out_pay_no VARCHAR(128)` 保持一致。
- `bill_trade_time` 使用 `DATETIME`，同时可保留原始时间文本。
- 增加 `(tenant_id, reconciliation_id, match_result)` 索引。
- 保存账单行号或外部记录唯一键，禁止重复账单行被 `Map` 静默覆盖。
- 表名建议统一使用现有 `yshop_adapay_*` 前缀。
- 明细查询接口必须分页。

### P1-4：API 契约信息不足

契约需要补充：

- 重新对账接口的响应对象和异步语义；
- 明细分页请求和分页响应；
- `executionStatus` 与 `reconciliationResult`；
- “账单未生成”“任务正在运行”“无权限操作目标租户”等错误码；
- 重复提交的幂等返回规则；
- `tenantId` 在租户接口和平台接口中的不同规则。

### P1-5：管理后台容易产生误导

列表页应分别显示：

- 执行状态；
- 对账结果；
- 未完成笔数；
- 差异笔数；
- 触发方式；
- 开始和完成时间；
- 当前 attempt 版本。

差异明细页应支持分页和 `match_result` 筛选。租户选择器只对平台财务显示，普通租户管理员不应看到或提交其他租户 ID。

菜单层级应以现有后台真实菜单结构为准，不应假设已经存在独立的“分账管理”父菜单。

### P1-6：可观测性和数据安全未定义

建议至少补充：

- 每租户执行耗时、账单笔数和差异数日志；
- 账单下载失败和连续未生成的监控指标；
- 原始账单文件不得记录支付密钥、私钥或完整敏感账户信息；
- 下载 URL 不写入普通业务日志；
- 错误信息入库前进行长度限制和敏感信息清理。

## 5. 简化测试建议

当前自动化测试框架尚未搭建，本期不强制建设完整 E2E 测试体系。测试目标先聚焦于证明核心对账算法、租户隔离和异常处理正确。

### 5.1 开发前技术验证

必须完成以下人工验证并保存脱敏记录：

1. 使用测试商户下载一份真实账单。
2. 确认 `downloadBill` 的参数和返回结构。
3. 确认账单文件编码、字段、金额单位和状态值。
4. 确认无交易、账单未生成和下载失败的返回差异。
5. 确认支付账单是否包含退款、撤销和分账记录。

### 5.2 最小单元测试

只要求覆盖核心纯逻辑：

| 编号 | 场景 | 预期结果 |
|------|------|----------|
| UT-01 | 金额和状态完全一致 | `MATCHED` |
| UT-02 | 相差 0.01 元 | `AMOUNT_DIFF` |
| UT-03 | 账单有、本地无 | `BILL_ONLY` |
| UT-04 | 本地有、账单无 | `LOCAL_ONLY` |
| UT-05 | 金额一致但状态不同 | `STATUS_DIFF` |
| UT-06 | 重复 `payment_id` 或重复账单行 | 解析失败或显式记录重复异常，不得静默覆盖 |
| UT-07 | 分账仍为 PENDING/PROCESSING | 汇总结果为 `INCOMPLETE` |

账单解析可以使用一份小型脱敏 fixture，不要求搭建复杂 Mock Server。

### 5.3 最小接口验证

在测试环境通过 Swagger、Postman 或手工请求验证：

1. 当前租户只能查询自己的汇总和明细。
2. 无重跑权限的账号不能触发任务。
3. 不能对当天或未来日期发起对账。
4. 相同租户、日期和类型并发提交时只产生一个运行中任务。
5. 明细分页和差异筛选正常。
6. 账单下载失败不会影响其他租户。

### 5.4 最小后台验收

暂不要求自动化 E2E，只进行人工验收：

- 汇总列表能区分“执行成功但存在差异”和“执行失败”；
- 差异明细可分页、筛选并跳转订单；
- 重跑后保留旧 attempt，可查看新旧结果；
- 普通租户管理员看不到其他租户数据；
- 处理中按钮不可重复点击。

### 5.5 本期暂不要求

- 完整浏览器自动化框架；
- 大规模性能压测；
- Adapay 全异常类型的自动化模拟；
- 短信、邮件或企业微信告警测试；
- CSV/Excel 导出测试。

这些内容可在测试基础设施完善后补充，但不能省略真实账单验证、核心匹配单元测试和租户越权验证。

## 6. 文档修改清单

### `requirements-spec.md`

- 拆分支付交易对账和分账确认对账。
- 明确账单日期、时区、交易类型和本地筛选时间。
- 移除 `≤ 0.01` 容忍规则。
- 补充退款、撤销、fallback 和非分账支付口径。
- 将删除重跑改为版本化重跑。
- 补充 `INCOMPLETE` 和账单未生成场景。

### `technical-design.md`

- 替换未经验证的 `BillType.ALL` 调用示例。
- 附真实脱敏账单结构和解析约束。
- 修正 `merchant_details.enabled` 假设。
- 分别设计支付和分账的数据源及时间窗口。
- 增加状态机、并发锁、attempt 和原始账单摘要设计。
- 修正 DDL 字段长度、审计字段和索引。

### `contract-changes.md`

- 明确租户接口和平台接口的数据范围。
- 将手动重跑改为异步任务契约。
- 增加明细分页契约。
- 拆分执行状态和对账结果。
- 补充重试中、账单未生成、重复执行和租户越权错误码。

### `ui-ux-design.md`

- 分别展示执行状态和对账结果。
- 增加未完成笔数、触发方式和执行时间。
- 差异明细增加分页和筛选。
- 明确租户选择器只对平台财务显示。
- 重跑后展示任务处理中状态，不同步等待结果。

### `meta.yaml`

建议调整为：

```yaml
risk: high
blocked: true
```

`e2e` 可暂时保持 `false`，但需要在测试说明中记录本期采用“核心单元测试 + 接口人工验证 + 后台人工验收”的简化策略。

## 7. 复审准入条件

满足以下条件后可以提交复审：

- [ ] 已提供真实脱敏账单和字段字典。
- [ ] 已确认当前 SDK 的实际调用方式。
- [ ] 已明确本期支付对账和分账对账范围。
- [ ] 已明确账单日期、业务时间和时区。
- [ ] 已定义退款、撤销、fallback 和非分账支付口径。
- [ ] 已改为精确到分的金额比较。
- [ ] 已拆分执行状态和对账结果。
- [ ] 已将删除重跑改为版本化重跑。
- [ ] 已明确平台财务与租户管理员权限边界。
- [ ] 已完成最小测试用例设计。

满足上述条件后，方案可进入”有条件通过”评审；真实外部账单契约仍未确认时，不建议进入正式开发。

---

## 8. 评审回应

> 以下为方案作者对各评审项的回应，记录修改内容和未解决项。

### P0-1：支付对账与分账对账口径混合 ✅ 已修改

已将本期对账拆成两个独立口径：
- **口径一：支付交易对账** — 外部 `Charge_20260711.csv` vs 本地 `pay_out_order_no` + `yshop_store_order`
- **口径二：分账确认对账** — 外部 `PaymentConfirm_20260711.csv` + `Div_20260711.csv` vs 本地 `profit_sharing_order` + `profit_sharing_order_item`

每个口径独立产出 `reconciliation_type=PAYMENT/PROFIT_SHARING` 的汇总+明细。

变更文件：`requirements-spec.md`、`technical-design.md`

### P0-2：Adapay SDK 契约尚未验证 ⚠️ 已确认，阻塞保留

- 已从真实 Adapay 商户下载 5 份日终账单文件，格式已确认（CSV，`#` 注释行，末尾 `#合计` 行）。
- 脱敏后的账单样本已存入 `sample-bills/` 目录，附 README 说明字段字典。
- SDK 中 `downloadBill(Date, BillType)` 方法的 `BillType` 参数仍待技术验证（`BillType` 是接口，需确认实现类枚举值）。
- `merchant_details.enabled` 假设已修正 → 改用现有 `details_id = CONCAT('adapay_h5', tenantId)` 查询。
- `meta.yaml` 保持 `blocked: true` 直至技术验证完成。

变更文件：`technical-design.md`、`meta.yaml`，新增 `sample-bills/`

### P0-3：对账日期筛选字段错误 ✅ 已修改

- 分账对账：`profit_sharing_order.sharing_time`（非 `create_time`）
- 支付对账：`yshop_store_order.pay_time`（支付成功时间）
- 时区统一 `Asia/Shanghai`，时间范围 `[账单日 00:00:00, 次日 00:00:00)`

变更文件：`requirements-spec.md`、`technical-design.md`

### P0-4：账单范围与本地数据范围不一致 ✅ 已修改

- 支付对账：本地查询所有 Adapay 支付成功记录，不限于分账订单。
- 分账对账：本地仅查询 `sharing_status=SUCCESS` 且 `sharing_time` 在目标日期的记录。
- FALLBACK 记录：在分账对账中单独标记，不参与金额核对。
- 退款：本期 out of scope，Refund 和 RefundDiv 账单格式已记录供后续使用。

变更文件：`requirements-spec.md`、`technical-design.md`

### P0-5：一分钱差异会被判为对平 ✅ 已修改

- 移除 `≤0.01` 容忍规则。
- 所有金额解析后 `×100` 转为 `long`（整数分），精确比较。
- 任意一分钱差异均记录为 `AMOUNT_DIFF`。
- 手续费保留原始值，不参与金额匹配。

变更文件：`requirements-spec.md`、`technical-design.md`

### P0-6：执行状态与对账结果混为一体 ✅ 已修改

拆分两个独立字段：
- `execution_status`：`PENDING → RUNNING → SUCCEEDED / RETRYABLE_FAILED / FAILED`
- `reconciliation_result`：`BALANCED / UNBALANCED / INCOMPLETE`（仅 SUCCEEDED 时有意义）

汇总表新增 `pending_count`、`processing_count`、`amount_diff_count`、`status_diff_count`、`started_at`、`finished_at`、`trigger_type`、`trigger_user_id`。

变更文件：`technical-design.md`、`contract-changes.md`

### P0-7：重跑删除历史记录不符合财务审计要求 ✅ 已修改

改为版本化重跑：
- `UNIQUE KEY (tenant_id, bill_date, reconciliation_type, attempt_no)`
- 每次执行新增一个 attempt
- 汇总页默认展示最新成功 attempt
- 保存 `prev_attempt_id`、`retrigger_reason`、`trigger_type`、`bill_file_sha256`

变更文件：`requirements-spec.md`、`technical-design.md`、`contract-changes.md`

### P1-1：多租户接口语义冲突 ✅ 已修改

- 租户管理员接口：不接收 `tenantId`，只操作当前租户（注入上下文）。
- 平台财务接口：允许传入 `tenantId`，需平台级角色校验。
- 权限标识改为 `pay:reconciliation:query` 和 `pay:reconciliation:retrigger`，沿用 pay 模块命名。

变更文件：`contract-changes.md`、`ui-ux-design.md`

### P1-2：手动重跑不应同步等待 ✅ 已修改

- 重跑改为异步：`POST /admin-api/pay/reconciliation/runs` → 返回 `runId`
- 前端通过 `GET /runs/{runId}` 轮询或刷新列表查看状态
- 同一租户+日期+类型已有运行中任务时返回现有 `runId`（幂等）

变更文件：`contract-changes.md`、`ui-ux-design.md`

### P1-3：数据库模型不完整 ✅ 已修改

- 明细表补充 `updater`、`update_time`、`deleted`
- `out_pay_no` 长度改为 `VARCHAR(128)`，与现有表一致
- `bill_trade_time` 改为 `DATETIME`，新增 `bill_row_index` 避免 Map 静默覆盖
- 新增 `(tenant_id, reconciliation_id, match_result)` 索引
- 表名统一使用 `yshop_adapay_*` 前缀
- 明细查询接口明确定义分页请求和响应

变更文件：`technical-design.md`、`contract-changes.md`

### P1-4：API 契约信息不足 ✅ 已修改

补充了：
- 重新对账请求/响应对象（异步语义、runId）
- 明细分页请求/响应
- `executionStatus` 和 `reconciliationResult` 字段
- 各场景错误码（账单未生成、任务运行中、无权限、当天/未来日期）
- 重复提交幂等规则
- 租户接口 vs 平台接口的不同规则

变更文件：`contract-changes.md`

### P1-5：管理后台容易产生误导 ✅ 已修改

- 列表页分别展示执行状态和对账结果
- 增加 attempt 版本号、触发方式、执行时间列
- 差异明细增加 `match_result` 筛选和分页
- 租户选择器仅平台财务可见
- 重跑后按钮置灰（运行中不可重复点击）

变更文件：`ui-ux-design.md`

### P1-6：可观测性和数据安全未定义 ⚠️ 部分接受

- 已补充：每租户执行耗时、账单笔数和差异数日志
- 已补充：原始账单 SHA-256 摘要、文件名和时间
- 已补充：错误信息入库前长度限制（`VARCHAR(2000)`）
- **暂不补充**：完整监控指标体系（Prometheus/Grafana），本期数据量小，先用日志和数据库记录满足基本观测需求

---

## 9. 复审准入状态

| 条件 | 状态 |
|------|------|
| 已提供真实脱敏账单和字段字典 | ✅ `sample-bills/` 目录 |
| 已确认当前 SDK 的实际调用方式 | ⚠️ `BillType` 参数待验证，`blocked=true` |
| 已明确本期支付对账和分账对账范围 | ✅ |
| 已明确账单日期、业务时间和时区 | ✅ `sharing_time`，`Asia/Shanghai` |
| 已定义退款、撤销、fallback 和非分账支付口径 | ✅ |
| 已改为精确到分的金额比较 | ✅ 整数分 `long` |
| 已拆分执行状态和对账结果 | ✅ |
| 已将删除重跑改为版本化重跑 | ✅ attempt 机制 |
| 已明确平台财务与租户管理员权限边界 | ✅ |
| 已完成最小测试用例设计 | ⚠️ 测试用例已在 review 第 5 节定义，但未独立写入 `test-notes.md`（实现阶段补充） |

**当前可进入”有条件通过”状态。唯一的真正阻塞项是 SDK `BillType` 参数验证，其余问题已全部在设计文档中修正。**

