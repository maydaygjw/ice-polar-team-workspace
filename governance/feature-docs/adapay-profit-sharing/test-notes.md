# 测试计划 — Adapay 分账规则与订单状态变更

## 1. 测试范围

| 端 | 功能点 |
|----|--------|
| 后端 | 店铺分账计费规则 CRUD、整单校验；按规则计算金额与手续费承担方；无规则 fallback 到 `commission_rate`；规则不完整时拒绝支付；日终分账 Job；分账失败回退 RevenueJob；订单状态更新为待评价。 |
| admin 前端 | 店铺分账计费规则配置页；店铺编辑页入口；分账结算记录详情展示 `calculationType` / `feeBearerRole` / `items`。 |

> 小程序端无变更，不纳入测试。

## 2. 测试策略

| 类型 | 取舍 |
|------|------|
| 单元测试 | 重点覆盖金额计算、整单校验、状态机转换。对 `ProfitSharingRuleService`、`ProfitSharingOrderService`、`ProfitSharingSettlementJob` 增加单元测试。 |
| 接口测试 | 覆盖规则保存/查询、分账订单查询/重试、店铺绑定收款人。Mock Adapay 调用，避免依赖沙箱。 |
| 端到端测试 | 实现后验证：admin 规则配置页 → 创建订单 → 支付回调 → 日终 Job → 订单状态更新全流程。 |
| 回归测试 | 必做。覆盖 Adapay 支付、分账收款人、店铺分账绑定、分账结算记录查询，确保既有分账流程不受影响。 |

## 3. 测试用例清单

### 3.1 店铺计费规则 CRUD 与整单校验

| 编号 | 用例 | 预期 |
|------|------|------|
| R-01 | 保存完整规则：4 角色均存在，比例和 = 100%，有且仅有一个承担方 | 保存成功，返回 4 条启用记录 |
| R-02 | 比例和 ≠ 100% | 后端拒绝，返回 `PROFIT_SHARING_RULE_INCOMPLETE` |
| R-03 | 缺少任一角色 | 后端拒绝，返回 `PROFIT_SHARING_RULE_INCOMPLETE` |
| R-04 | 无承担方 | 后端拒绝，返回 `PROFIT_SHARING_RULE_FEE_BEARER_INVALID` |
| R-05 | 多个承担方 | 后端拒绝，返回 `PROFIT_SHARING_RULE_FEE_BEARER_INVALID` |
| R-06 | 同一角色存在两条启用记录 | 后端按整单替换处理，最终生效态唯一 |
| R-07 | 将某角色 status 设为 0 | 规则不完整，后续支付被拒绝 |
| R-08 | 删除店铺整套规则 | 后续支付 fallback 到 `commission_rate` |
| R-09 | 查询 `list-by-shop?shopId=1` | 返回该店铺所有角色规则及 `feeBearer` 标记 |

### 3.2 无规则时 fallback 到 `commission_rate`

| 编号 | 用例 | 预期 |
|------|------|------|
| F-01 | 店铺启用分账但 `yshop_adapay_profit_sharing_rule` 无任何记录 | 创建分账记录，`calculation_type=2`，`platform_amount=commission_amount`，`shop_amount=pay_price-commission_amount` |
| F-02 | fallback 时仍缺少平台/店铺收款人 | 支付被拒绝，返回 `PROFIT_SHARING_PAY_DISABLED` |
| F-03 | fallback 记录不写入 `yshop_adapay_profit_sharing_order_item` | 表中无对应明细 |

### 3.3 规则不完整时支付被拒绝

| 编号 | 用例 | 预期 |
|------|------|------|
| P-01 | 规则存在但角色缺失 | 支付前抛错，返回 `PROFIT_SHARING_RULE_INCOMPLETE` |
| P-02 | 规则存在但比例和 ≠ 100 | 支付前抛错，返回 `PROFIT_SHARING_RULE_INCOMPLETE` |
| P-03 | 规则存在但无承担方 | 支付前抛错，返回 `PROFIT_SHARING_RULE_FEE_BEARER_INVALID` |
| P-04 | 规则完整但某角色有效收款人缺失 | 支付前抛错，返回 `PROFIT_SHARING_RECIPIENT_MISSING_FOR_ROLE` |
| P-05 | 店铺未绑定收款人 | 支付前抛错，返回 `PROFIT_SHARING_SHOP_RECIPIENT_MISSING` |

### 3.4 按规则计算各角色金额与手续费承担方

| 编号 | 用例 | 预期 |
|------|------|------|
| C-01 | 4 角色比例 10/70/10/10，店铺承担手续费 | 各角色金额按 `pay_price × percentage/100` 计算，店铺角色 `fee_flag=1`，其余 `0` |
| C-02 | 比例含 0% | 对应角色金额为 0，仍参与 `div_members` 且 `fee_flag` 按规则标记 |
| C-03 | 金额和因四舍五入差额 1 分 | 差额吸收到最大金额角色，最终 `Σamount = pay_price` |
| C-04 | 创建分账记录后修改规则 | 已创建记录金额不变，验证固化逻辑 |

### 3.5 分账成功/回退后订单状态更新为待评价

| 编号 | 用例 | 预期 |
|------|------|------|
| S-01 | 日终 Job 中 `PaymentConfirm.create` 成功 | `sharing_status=2`，`yshop_store_order.status=2` |
| S-02 | 分账失败并回退到 RevenueJob | `sharing_status=4`，`fallback_revenue=1`，`yshop_store_order.status=2` |
| S-03 | 分账未完成时订单状态仍为原状态 | `status ≠ 2` |
| S-04 | `OrderApi.markOrderSettled` 失败 | 分账状态不推进，记录错误日志，Job 下次/手动重试 |

### 3.6 分账失败回退到 RevenueJob

| 编号 | 用例 | 预期 |
|------|------|------|
| B-01 | Adapay 返回失败 | `sharing_status=3`，写入错误信息 |
| B-02 | 失败后触发回退 | 创建店铺收入 type=1 与平台抽成 type=3 的 StoreRevenue 记录 |
| B-03 | 已回退记录不可再次回退 | `fallback_revenue=1` 时跳过 |
| B-04 | 已回退记录不允许手动重试 | 返回 `PROFIT_SHARING_ORDER_STATUS_INVALID_FOR_RETRY` |

### 3.7 日终 Job 幂等性

| 编号 | 用例 | 预期 |
|------|------|------|
| J-01 | 同一订单 `sharing_status=2` | Job 不再处理 |
| J-02 | 同一订单 `sharing_status=4` | Job 不再处理 |
| J-03 | Job 中途异常重启 | 下次调度从 `sharing_status=0` 继续，已 `=1` 的记录视超时处理逻辑而定 |
| J-04 | 重复调度同一批次 | 同一订单只向 Adapay 确认一次分账 |

### 3.8 管理后台规则配置页面交互

| 编号 | 用例 | 预期 |
|------|------|------|
| A-01 | 打开规则配置页，选择店铺 | 展示 4 角色输入行，支持比例与承担方开关 |
| A-02 | 保存时前端即时校验比例和 | 比例和 ≠ 100 时前端拦截并提示 |
| A-03 | 保存时前端校验唯一承担方 | 未选或多选时前端拦截 |
| A-04 | 店铺编辑页新增「分账计费规则」入口 | 点击跳转至规则配置页并带入 `shopId` |
| A-05 | 分账结算记录详情 | 展示 `calculationType`、`feeBearerRole` 与 `items` 明细 |

> 编号 A-01 ~ A-05 均为「实现后验证」。

## 4. 测试数据准备

| 数据 | 说明 |
|------|------|
| 租户 | 固定测试租户 `tenant_id=1` |
| 店铺 | `shop_1`（启用分账）、`shop_2`（未启用分账） |
| 平台级收款人 | 平台角色 `recipient_p`、配送角色 `recipient_d`、销售角色 `recipient_s`，均为启用状态 |
| 店铺级收款人 | 归属 `shop_1` 的收款人 `recipient_shop`，已启用 |
| 完整计费规则 | `shop_1` 下 4 角色比例 10/70/10/10，店铺承担手续费 |
| 不完整计费规则 | `shop_1` 下仅平台/店铺两条角色记录 |
| 订单 | Adapay 支付成功订单，状态为待收货（`status=1`），`refund_status=0`，`pay_price=100.00` |
| 佣金配置 | `commission_rate` 配置使 `commission_amount=10.00` |

## 5. 风险与重点关注点

| 风险 | 关注点 |
|------|--------|
| 金额计算 | 比例和校验、四舍五入差额吸收、`Σamount = pay_price` 前置/执行前双重校验。 |
| 订单状态一致性 | 分账记录与 `yshop_store_order.status` 必须同事务或最终一致；`markOrderSettled` 失败时状态不回滚。 |
| 手续费承担方映射 | 仅承担方角色 `fee_flag=1`，其余 `0`；承担方必须是已配置的 4 角色之一。 |
| 规则不完整 vs fallback | 完全无规则才 fallback；规则存在但不完整必须拒绝支付，不能静默 fallback。 |
| Job 幂等 | 依赖 `sharing_status` 状态机，需验证重复调度不重复分账。 |
| 跨模块调用 | `pay-biz → order-api` 调用失败时的降级与告警。 |

## 6. 回归范围

| 模块 | 回归点 |
|------|--------|
| Adapay 支付 | 未启用分账店铺支付流程不变；支付回调、订单状态流转正常。 |
| 分账收款人 | 创建/编辑/删除/查询、结算账户更换、MemberId 编码、银行列表加载不受影响。 |
| 店铺分账绑定 | 绑定/解绑店铺级收款人、启用/禁用开关逻辑不变。 |
| 分账结算记录查询 | 列表/搜索/失败重试、详情字段扩展后既有查询条件仍可用。 |
