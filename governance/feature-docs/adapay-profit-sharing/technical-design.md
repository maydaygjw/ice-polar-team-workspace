# 技术设计 — Adapay 分账结算

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-biz` | 修改 | 新增分账收款人 CRUD、分账订单 Service、Adapay 分账 SDK 封装（Member/结算账户创建、结算账户更换、`Payment.create` delay、`PaymentConfirm.create`）、日终结算 Job、分账失败回退、**银行字典表与列表 API** |
| `yshop-module-pay-api` | 修改 | 新增分账 DTO、Service 接口、ErrorCode、**银行列表 DTO** |
| `yshop-module-store-biz` | 修改 | 店铺绑定/解绑分账收款人；查询时返回分账启用状态 |
| `yshop-module-store-api` | 修改 | 新增店铺绑定分账收款人 DTO |
| `yshop-module-order-biz` | 修改 | `paySuccess()` 中 Adapay 支付且店铺启用分账时，调用 pay-api 创建分账挂起记录；校验收款人配置 |
| `yshop-module-mall` (sql) | 修改 | 新增迁移脚本 |

### 跨模块依赖

```
yshop-module-order-biz ──→ yshop-module-pay-api (ProfitSharingOrderApi)
yshop-module-store-biz ──→ yshop-module-pay-api (ProfitRecipientApi)
```

## 架构决策

1. **延迟分账**：支付时 `pay_mode=delay`，资金冻结在平台账户，日终统一执行分账确认。避免实时分账带来的并发和部分退款复杂性。
2. **分账金额固化**：`yshop_adapay_profit_sharing_order` 创建时即计算并固化 `commission_amount`、`shop_amount`，不受后续 `commission_rate` 变更影响。
3. **MemberId 编码**：`member_id` 不依赖 Adapay 返回值，按本地规则 `m_{租户Id}_{memberType}_{IdCard}_{storeId|0 for 平台}` 生成。天然保证同店铺同身份证号不可重复创建收款人。
4. **平台级收款人角色唯一**：同租户同角色只有一个启用中的平台级收款人。通过业务层校验实现（创建时将同角色其他记录置为 `status=0`），不用数据库唯一索引。
5. **店铺级收款人无角色**：店铺级收款人默认归属于指定店铺，无需分账角色。店铺只能选择绑定该店铺的收款人。
6. **结算账户以“更换”方式修改**：编辑收款人基础信息时不重新提交银行卡；只有管理员明确选择更换结算账户时，才提交完整新银行卡信息并同步调用 Adapay 更新绑定。详情接口只返回脱敏摘要，不返回完整旧卡号。
7. **分账失败兜底**：Adapay 分账失败后，自动回退到现有 `RevenueJob` 虚拟余额结算，标记 `fallback_revenue=1`，保证店铺收入不丢失。
8. **支付前置校验**：店铺启用分账但缺少有效平台/店铺收款人时，拒绝支付。失败在支付前暴露，不等到日终才报错。
9. **禁用分账允许解绑收款人**：店铺关闭分账启用开关时，`profit_sharing_recipient_id` 与 `profit_sharing_enabled` 同步清空，店铺可回到无分账收款人状态。
10. **Member 与结算账户同步创建**：创建收款人时串行调用 Adapay 创建 Member → 绑定结算账户，任一步失败直接抛错不入库，避免后续分账因缺少结算账户失败。
11. **Job 幂等**：通过 `sharing_status` 状态机保证，同一订单不会重复分账。
12. **分账前金额校验**：执行分账前校验 `platform_amount + shop_amount == pay_price`，不一致时标记失败不分账。
13. **更换失败保持原账户**：更换结算账户调用 Adapay 失败时，本地收款人基础信息和原结算账户绑定保持不变，避免出现本地显示已更新但远程仍为旧账户的不一致状态。
14. **Adapay Member 已存在时复用并清理旧结算账户**：创建收款人时若 Adapay 返回 `member_id_exists`，不再强制创建 Member，而是复用该 MemberId；通过 Adapay `Member.query` / `CorpMember.query` 获取其下结算账户列表并逐条删除，再绑定新的结算账户。Adapay 不支持强制删除 Member，因此通过清理结算账户实现“重置”效果。
15. **银行列表后端化**：Adapay 支持银行列表（约 5260 条）由前端静态 JSON 改为后端数据库表 `yshop_pay_bank` 维护。前端通过 API 动态获取，创建/更新收款人时后端强制校验 `bankCode` 必须存在且启用。数据通过迁移脚本从 `bank-list.json` 初始化；本期为只读字典表，不单独开发后台管理页面。

> 无新架构范式，复用现有模块分层、多租户拦截器、Job 调度模式。不新增 ADR。

## 流程设计

### 分账订单状态机

```
0 (待分账) ──→ 1 (分账中) ──→ 2 (分账成功)
                   │
                   └──→ 3 (分账失败) ──→ 4 (已回退)
                                        │
                                        └──→ 手动重试 → 1
```

- `0→1`: Job 开始执行分账
- `1→2`: Adapay 返回成功
- `1→3`: Adapay 返回失败
- `3→4`: 自动回退到 RevenueJob 后标记
- `3→1`: 管理后台手动重试（仅 `fallback_revenue=0` 时）

### 核心链路

**支付时挂起**：用户支付 → Adapay 回调 → `paySuccess()` → 校验收款人 → 计算抽成 → 调用 `ProfitSharingOrderApi.createSharingOrder()` 写入待分账记录（`status=0`）

**日终结算**：Quartz 每日 00:05 → 多租户遍历 → 查询 `status=0` 且订单可结算的记录 → 分页（每批 100）→ 调用 `PaymentConfirm.create` → 更新 `status=2` 或 `3`

**失败回退**：`status=3` → 写入 `RevenueJob` 店铺收入（type=1）和平台抽成（type=3）→ 标记 `fallback_revenue=1`

**编辑收款人**：管理员打开编辑弹窗 → 后台返回收款人基础信息与结算账户脱敏摘要 → 未选择更换时仅更新基础信息 → 选择更换时提交完整新银行卡 → Adapay 绑定成功后本地更新脱敏摘要与结算账户标识

**银行列表加载**：前端打开收款人表单 → 调用 `GET /admin-api/pay/bank/list` → 后端从缓存/数据库返回启用中的银行列表 → 前端渲染 `el-select` 下拉

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| Adapay 分账 API 调用失败 | 高 | 自动回退 RevenueJob + 后台手动重试 |
| 分账金额计算错误 | 高 | 创建时固化 + 执行前校验 `platform + shop == payPrice` |
| 店铺未绑定收款人 | 中 | 支付时前置校验，明确错误提示 |
| 更换结算账户失败导致本地/远程不一致 | 高 | Adapay 成功后再更新本地；失败时保留原账户并提示 |
| 银行卡敏感信息泄露 | 高 | 详情接口仅返回脱敏摘要，不返回完整旧卡号 |
| 退款订单已分账 | 中 | 本期 deferred；后续通过 `PaymentConfirmReverse` 实现 |
| 日终 Job 超时 | 低 | 分页处理，每批 100；支持幂等重跑 |
| 企业 Member 附件存储 | 低 | 复用现有文件存储接口 |
| 银行列表数据初始化失败 | 中 | 迁移脚本包含回滚；初始化后校验记录数与 `bank-list.json` 一致 |
| 银行列表查询性能 | 低 | 启用本地缓存或 Redis 缓存；列表只读，变更极少 |

## 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/adapay-profit-sharing` |
| `admin/` | `feat/adapay-profit-sharing` |

> `miniapp/` 无变更，C 端用户无感知。

## 分账规则与订单状态变更设计

> 本节记录本次新增需求：店铺级分账计费规则、按规则计算分账金额、手续费承担方配置、分账成功/回退后订单状态更新为待评价。

### 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-biz` | 修改 | 新增分账计费规则 DO/Mapper/Service/Controller；扩展分账订单 Service 支持多角色分账与手续费承担方；日终 Job 增加订单状态过滤与 `yshop_store_order.status = 2` 更新；新增 `yshop-module-order-api` 依赖 |
| `yshop-module-pay-api` | 修改 | 新增计费规则角色枚举、规则查询/校验内部 API、扩展 `CreateSharingOrderDTO` 及分账明细 DTO |
| `yshop-module-order-biz` | 修改 | `createProfitSharingOrder(...)` 中按店铺计费规则计算各方金额与手续费承担方；无规则时 fallback 到 `commission_rate`；规则不完整时拒绝支付 |
| `yshop-module-store-biz` | 复用/微改 | 店铺响应 VO 可附带分账计费规则完整性标记（调用 pay-api 获取）；店铺绑定收款人逻辑不变 |
| `yshop-module-store-api` | 复用 | 现有 `ShopBindProfitRecipientReqDTO` 与绑定逻辑继续生效；本期无新 DTO |
| `admin/` | 修改 | 新增「店铺分账计费规则」配置页面；店铺编辑页增加规则配置入口 |

#### 跨模块依赖

```
yshop-module-order-biz ──→ yshop-module-pay-api (ProfitSharingRuleApi / ProfitRecipientApi / ProfitSharingOrderApi)
yshop-module-pay-biz     ──→ yshop-module-order-api (OrderApi.markOrderSettled)
yshop-module-store-biz   ──→ yshop-module-pay-api (ProfitSharingRuleApi)
```

新增依赖方向 `pay-biz → order-api` 与既有 `order-biz → pay-api` 不形成循环（API 模块之间无依赖）。

### 架构决策

1. **计费规则表设计**：一店铺一套规则，按角色拆分为多条记录。角色枚举：`1=平台`、`2=店铺`、`3=配送方`、`4=销售方`。每条记录配置 `percentage`（分账比例）与 `fee_bearer`（是否承担手续费）。
2. **完整有效规则判定**：同一店铺下，同时满足以下条件视为完整有效：
   - 4 个角色均存在且 `status=1` 的记录；
   - 4 条记录 `percentage` 之和等于 100；
   - 有且仅有一条记录 `fee_bearer=1`；
   - 各角色对应的有效收款人已配置（平台/配送/销售角色取平台级收款人；店铺角色取店铺绑定的店铺级收款人）。
3. **fallback 到 `commission_rate` 的触发条件**：仅当店铺在 `yshop_adapay_profit_sharing_rule` 中**完全未配置任何规则记录**时，创建分账记录时 fallback 到现有逻辑：`platform_amount = commission_amount`，`shop_amount = pay_price - commission_amount`。若已配置规则但规则不完整（角色缺失、比例和 ≠100、无唯一承担方、收款人缺失/禁用），支付时应拒绝并提示配置缺失，不得静默 fallback。
4. **订单状态更新时机**：走 Adapay 分账的订单，在日终 Job 中：
   - `PaymentConfirm.create` 返回成功 → 分账记录置为成功，并调用 `OrderApi.markOrderSettled(orderId)` 更新 `yshop_store_order.status = 2`；
   - 分账失败并回退到 RevenueJob 后 → 分账记录置为已回退，并同样调用 `OrderApi.markOrderSettled(orderId)` 更新订单状态为 2。
   分账未完成前，订单状态不得提前变为 2。
5. **手续费承担方在 `div_members` 中的体现**：调用 `PaymentConfirm.create` 时，仅手续费承担方对应的成员 `fee_flag = "Y"`，其余成员均为 `"N"`。`fee_flag` 在创建分账记录时固化到分账明细表中。
6. **分账金额总和校验**：创建分账记录时校验各角色金额之和等于 `pay_price`（允许四舍五入到分，差额由最大金额角色 absorbing）。执行分账前再次校验；不一致则标记失败。
7. **分账明细固化**：新增 `yshop_adapay_profit_sharing_order_item` 子表，支付创建分账记录时固化「角色-收款人-金额-是否承担手续费」。后续规则或收款人变更不影响已创建分账记录。
8. **无新 ADR**：复用现有延迟分账 + 日终结算架构、模块分层、多租户与 Job 模式。

### 数据模型

#### 新建表：`yshop_adapay_profit_sharing_rule`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK AUTO_INCREMENT | |
| `tenant_id` | BIGINT NOT NULL | 租户隔离 |
| `shop_id` | BIGINT NOT NULL | 关联 `yshop_store_shop.id` |
| `role` | TINYINT NOT NULL | 角色：`1=平台`、`2=店铺`、`3=配送方`、`4=销售方` |
| `percentage` | DECIMAL(5,2) NOT NULL | 分账比例（%），如 `10.00` 表示 10% |
| `fee_bearer` | TINYINT NOT NULL DEFAULT 0 | 是否承担手续费：`0=否`、`1=是` |
| `status` | TINYINT NOT NULL DEFAULT 1 | 状态：`0=禁用`、`1=启用` |
| `creator` | VARCHAR(64) | BaseDO 审计字段 |
| `updater` | VARCHAR(64) | BaseDO 审计字段 |
| `create_time` | DATETIME | BaseDO 审计字段 |
| `update_time` | DATETIME | BaseDO 审计字段 |
| `deleted` | TINYINT NOT NULL DEFAULT 0 | 逻辑删除 |

索引：
- `idx_tenant_shop_status` (`tenant_id`, `shop_id`, `status`)
- `idx_tenant_shop_role` (`tenant_id`, `shop_id`, `role`)
- `uk_tenant_shop_role_deleted` (`tenant_id`, `shop_id`, `role`, `deleted`) — 同一店铺同一角色在生效态唯一；业务层保存时按「整单替换」处理

#### 修改表：`yshop_adapay_profit_sharing_order`

新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `calculation_type` | TINYINT NOT NULL DEFAULT 2 | 计算方式：`1=计费规则`、`2=佣金比例回退` |
| `fee_bearer_role` | TINYINT NULL | 手续费承担角色（`calculation_type=1` 时必填） |

#### 新建表：`yshop_adapay_profit_sharing_order_item`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGINT PK AUTO_INCREMENT | |
| `tenant_id` | BIGINT NOT NULL | 租户隔离 |
| `sharing_order_id` | BIGINT NOT NULL | 关联 `yshop_adapay_profit_sharing_order.id` |
| `role` | TINYINT NOT NULL | 角色：`1=平台`、`2=店铺`、`3=配送方`、`4=销售方` |
| `recipient_id` | BIGINT NOT NULL | 关联 `yshop_adapay_profit_recipient.id` |
| `amount` | DECIMAL(10,2) NOT NULL | 该角色分账金额 |
| `fee_flag` | TINYINT NOT NULL DEFAULT 0 | 是否承担手续费：`0=N`、`1=Y` |
| `creator` / `updater` / `create_time` / `update_time` / `deleted` | | BaseDO 审计字段与逻辑删除 |

索引：
- `idx_sharing_order_id` (`sharing_order_id`)
- `idx_tenant_sharing_order` (`tenant_id`, `sharing_order_id`)

### 流程设计

#### 支付时创建分账记录（含规则 / fallback 分支）

```
用户完成 Adapay 支付
  → AppStoreOrderServiceImpl.paySuccess()
      → 店铺启用分账？
          否 → 结束
          是 → 校验店铺收款人
              → 查询 yshop_adapay_profit_sharing_rule
                  ├─ 无任何规则记录 → fallback: platform_amount=commission_amount, shop_amount=pay_price-commission_amount, calculation_type=2
                  ├─ 规则存在但不完整 → 抛错，拒绝支付
                  └─ 规则完整 → 按 percentage 计算各角色金额，确定 fee_bearer_role，映射 recipient，calculation_type=1
              → 调用 ProfitSharingOrderApi.createSharingOrder(dto)
                  → 校验金额和 = pay_price
                  → 写入 yshop_adapay_profit_sharing_order
                  → 若 calculation_type=1，写入 yshop_adapay_profit_sharing_order_item
                  → 写操作日志
```

#### 日终 Job 分账确认 + 订单状态更新

```
Quartz 每日 00:05 触发 ProfitSharingSettlementJob
  → 多租户遍历
  → 分页查询 sharing_status=0 且关联 store_order.status=1、refund_status=0、create_time<今日零点的记录
  → 对每笔分账记录：
      1. 更新 sharing_status=1（分账中）
      2. 加载分账明细（或 fallback 的平台/店铺收款人）
      3. 校验收款人仍有效、金额和 = pay_price
      4. 组装 div_members（fee_flag 取自 item.fee_flag）
      5. 调用 PaymentConfirm.create
      6. 成功：
           - sharing_status=2, sharing_time=now, adapay_confirm_id=...
           - 调用 OrderApi.markOrderSettled(orderId) → yshop_store_order.status=2
      7. 失败：
           - sharing_status=3, error_msg=...
           - 进入 RevenueJob 回退流程
```

#### 分账失败后 RevenueJob 回退 + 订单状态更新

```
executeSharing 返回失败
  → fallbackToRevenue(order)
      → 确认 sharing_status=3 且 fallback_revenue=0
      → 创建店铺收入（type=1）和平台抽成（type=3）的 StoreRevenue 记录
      → sharing_status=4, fallback_revenue=1
      → 调用 OrderApi.markOrderSettled(orderId) → yshop_store_order.status=2
      → 写 ROLLBACK 日志
```

### 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 计费规则比例和不为 100 导致金额错误 | 高 | 保存规则整单校验；创建分账记录时再次校验；差额吸收到最大角色金额 |
| 订单状态更新与分账状态不一致 | 高 | 同一事务内更新分账记录并调用 OrderApi；失败时状态保持原值，Job 次日/手动重试 |
| 规则不完整导致支付被拒绝 | 中 | 管理后台保存规则时强制校验并提示；支付错误码明确区分「规则不完整」 |
| 手续费承担方配置错误 | 中 | 保存时强制「有且仅有一个承担方」；执行分账前复核 |
| 日终 Job 查询关联 store_order 性能下降 | 低 | 索引覆盖 `(tenant_id, sharing_status, create_time)` 与 `(tenant_id, order_id)`；分页 100 |
| 分账失败后 RevenueJob 也失败 | 中 | 记录失败日志与状态；管理后台可手动重试分账；监控告警 |
| 跨模块依赖 `pay-biz → order-api` 引入循环 | 低 | API 模块之间无依赖，实际无循环；代码审查时复核 |

### 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/adapay-profit-sharing-rule` |
| `admin/` | `feat/adapay-profit-sharing-rule` |

`miniapp/` 无变更。

## 契约层状态

| 层 | 状态 | 引用 |
|----|------|------|
| DB schema | 变更 | → contract-changes.md §数据库变更 |
| API | 新增/修改 | → contract-changes.md §端点变更 / §DTO 变更 |
| 事件/MQ | N/A | 无新增事件 |
| 依赖 | 变更 | → contract-changes.md §依赖变更 |
| ADR | 不需要 | 复用现有模块分层、多租户、Job 模式，无新架构范式 |
