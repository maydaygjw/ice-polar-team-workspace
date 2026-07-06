# Adapay 分账结算 代码审查报告

## 1. 总体结论：PASS_WITH_NOTES

本次审查覆盖 `feat/adapay-profit-sharing` 分支的后端与 Admin 端实现。整体功能已实现需求定义的核心流程：分账收款人管理、店铺绑定、Adapay 延迟分账、日终结算 Job、失败回退与手动重试、管理后台页面。存在若干**非阻塞性问题**需要记录并建议修复，详见下文。

---

## 2. 审查清单逐项

### 2.1 实现是否符合需求规格

| 需求项 | 状态 | 说明 |
|--------|------|------|
| 分账收款人 CRUD | 通过 | 平台级/店铺级、角色字段完整；创建/更新时有角色唯一性处理。 |
| 同角色平台级收款人唯一 | 通过 | 创建/更新启用状态时自动禁用同角色旧记录。 |
| 已绑定收款人拒绝删除 | **未实现** | `ProfitRecipientServiceImpl.deleteProfitRecipient` 直接调用 `deleteById`，未校验店铺绑定。需求与合同均要求返回 `PROFIT_RECIPIENT_BOUND`。 |
| 店铺绑定/解绑 | 通过 | `/admin-api/store/shop/bind-profit-recipient` 接口、状态与 recipient_id 联动。 |
| Adapay 延迟分账 | 通过 | `pay_mode=delay` 在 `AppStoreOrderServiceImpl.pay()` 中根据店铺启用状态注入。 |
| 支付成功创建分账记录 | 通过 | `paySuccess()` → `createProfitSharingOrder()` → `ProfitSharingOrderApi.createSharingOrder()`。 |
| 支付前校验收款人配置 | 部分通过 | 支付时设置了延迟分账，但**缺少支付前拒绝逻辑**：`pay()` 仅在 `adapayPayOrder.addAttr("pay_mode", "delay")` 而未在缺少有效收款人时提前抛 `PROFIT_SHARING_PAY_DISABLED`。当前校验在 `paySuccess()` 中抛出，意味着用户已完成支付后才被拒绝，违反 AC-3。 |
| 日终结算 Job | 通过 | `ProfitSharingSettlementJob` 每日由 Quartz 触发，分页 100 条，按 `create_time < 今日 00:00` 查询。 |
| 失败回退 RevenueJob | 通过 | Job 失败时调用 `StoreRevenueApi.batchCreateStoreRevenue` 写入店铺收入与平台抽成。 |
| 分账订单查询与重试 | 通过 | 分页/详情/重试接口已实现，前端失败重试按钮按状态显示。 |
| 分账操作日志 | 通过 | `yshop_adapay_profit_sharing_log` 创建/执行/回退均有记录。 |

### 2.2 API 合约是否符合 contract-changes.md

| 合约项 | 状态 | 说明 |
|--------|------|------|
| 路径与权限 | 通过 | `/pay/profit-recipient/*`、`/pay/profit-sharing-order/*`、`/store/shop/bind-profit-recipient` 与权限标识一致。 |
| 分账状态枚举 | 通过 | `ProfitSharingStatusEnum` 与文档一致。 |
| 响应结构 | 通过 | 使用 `CommonResult`/`PageResult`。 |
| `memberId` 校验规则 | 部分通过 | 后端 `ProfitRecipientBaseVO` 仅校验非空与长度，**未校验正则**（英文/数字/下划线）。前端表单已加正则校验，但合约要求后端同样校验。 |
| `list-by-shop` 返回规则 | 通过 | 返回平台级（角色=平台）+ 该店铺级收款人。 |
| 内部 API 合约 | 通过 | `ProfitSharingOrderApi.createSharingOrder`、`ProfitRecipientApi.listByShop/getActiveRecipient/getRecipient` 与合同一致。 |

### 2.3 无硬编码密钥

- 通过。未在新增代码中发现硬编码的 API 密钥、数据库密码或 JWT 密钥。Adapay SDK 调用依赖项目既有配置。

### 2.4 多租户隔离

| 检查点 | 状态 | 说明 |
|--------|------|------|
| 新表含 `tenant_id` | 通过 | `yshop_adapay_profit_recipient`、`yshop_adapay_profit_sharing_order`、`yshop_adapay_profit_sharing_log` 均含。 |
| 查询自动注入 `tenant_id` | 通过 | 使用 MyBatis Plus `BaseMapperX` / `LambdaQueryWrapperX`，依赖 `TenantLineInnerInterceptor`。 |
| 跨租户调用校验 | **需关注** | `ProfitRecipientApi.getRecipient(Long id)` 与 `ProfitRecipientApi.getActiveRecipient(Long tenantId, Integer role)` 暴露给 `store-biz` / `order-biz` 使用。当前实现未在 API 层显式校验 `id` 是否属于当前租户；由于调用链路均发生在同一请求线程且 `TenantLineInnerInterceptor` 会注入，通过 Mapper 查询可保证隔离，但**内部 API 参数中的 `tenantId` 与 DTO 中的 `tenantId` 存在被伪造风险**。建议内部 API 实现侧校验 `TenantContextHolder.getTenantId()` 与传入 `tenantId` 一致。 |
| `ProfitSharingSettlementJob.saveLog` | **缺陷** | 使用 `orderTenantId(sharingOrderId)` 从 DB 读取租户 ID，而非当前 Job 线程的 `TenantContextHolder`。`@TenantJob` 已经按租户循环执行，此处应使用 `TenantContextHolder.getTenantId()`，避免跨租户日志写入混乱。 |

### 2.5 迁移脚本

- 通过。`sql/upgrade-adapay-profit-sharing.sql` 已存在，包含三张新表与 `yshop_store_shop` 字段扩展，索引、注释与字段类型与技术设计一致。
- 建议：增加 `yshop_store_order` 的说明注释无需 DDL，当前脚本已足够。

### 2.6 测试覆盖

| 测试类型 | 状态 | 说明 |
|----------|------|------|
| 后端单元/集成测试 | **缺失** | 未找到针对 `ProfitRecipientServiceImpl`、`ProfitSharingOrderServiceImpl`、`ProfitSharingSettlementJob` 的 Java 测试类。 |
| E2E 测试 | 通过 | `admin/e2e/adapay-profit-sharing.spec.ts` 覆盖平台级/店铺级收款人创建、店铺绑定、记录列表查看。 |

### 2.7 ADR 是否需要更新

- 无需更新。本次为功能实现，架构决策已在 `technical-design.md` 中记录。

### 2.8 分支命名

- 通过。后端与 Admin 均使用 `feat/adapay-profit-sharing`。

### 2.9 代码重复

| 位置 | 状态 | 说明 |
|------|------|------|
| `processOrder` 与 `executeSharing` | **重复** | `ProfitSharingSettlementJob.processOrder()` 与 `ProfitSharingOrderServiceImpl.executeSharing()` 的核心分账逻辑（构造参数、调用 `PaymentConfirm.create`、处理响应、更新状态、记录日志）高度重复，应抽取公共方法到 `ProfitSharingOrderServiceImpl` 或工具类，由 Job 调用 `executeSharing` 复用。 |
| `buildDivMember` / `isSuccessResponse` / `getString` | 重复 | 同时出现在 Service 与 Job 中，应下沉到公共位置。 |

### 2.10 安全

| 风险 | 状态 | 说明 |
|------|------|------|
| SQL 注入 | 通过 | 使用 MyBatis Plus Wrapper，无拼接 SQL。 |
| XSS | 通过 | 后台管理输入均为文本，前端使用 Element Plus 默认转义；API 返回数据未直接渲染为 HTML。 |
| 越权删除收款人 | **风险** | `deleteProfitRecipient` 未校验是否被店铺绑定，也未校验是否跨租户（依赖拦截器）。 |
| 越权绑定店铺收款人 | 部分通过 | `StoreShopServiceImpl.bindProfitRecipient` 校验了收款人存在、启用、类型、店铺匹配，但未显式校验 `shopId` 是否在当前管理员门店范围（依赖 Controller 层的 `@PreAuthorize` 与门店范围过滤，建议补充）。 |
| 金额精度 | 需关注 | `BigDecimal.toString()` 传给 Adapay，需确保 Adapay 接受该格式；`confirm_amt` 使用 `payPrice.toString()`，分账金额使用 `commissionAmount.toString()` 与 `shopAmount.toString()`。建议统一使用 `setScale(2, RoundingMode.HALF_UP).toPlainString()` 避免科学计数法。 |

### 2.11 跨模块依赖

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `order-biz` → `pay-api` | 通过 | `AppStoreOrderServiceImpl` 注入 `ProfitSharingOrderApi`、`ProfitRecipientApi` 接口，pom 已依赖 `yshop-module-pay-api`。 |
| `store-biz` → `pay-api` | 通过 | `StoreShopServiceImpl` 注入 `ProfitRecipientApi`，pom 已依赖 `yshop-module-pay-api`。 |
| `-biz` 之间直接依赖 | **违规** | `yshop-module-order-biz/pom.xml` 与 `yshop-module-store-biz/pom.xml` 仍声明了对 `yshop-module-pay-biz` 的依赖。虽然本次新增的内部 API 调用通过 `-api` 模块进行，但旧依赖未清理，违反 `-api` 模块规则，建议移除。 |
| `pay-biz` → `store-api` | 通过 | `ProfitSharingSettlementJob` 通过 `StoreRevenueApi` 调用，pom 已依赖 `yshop-module-store-api`。 |

### 2.12 UI/UX 一致性（仅检查 Admin）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 页面布局 | 通过 | 收款人管理与记录页沿用 `ContentWrap` + 搜索 + 表格 + 分页结构。 |
| 表单字段 | 通过 | `ProfitSharingReceiverForm.vue` 与需求设计一致。 |
| 店铺绑定交互 | 通过 | `ShopForm.vue` 中选择收款人后自动启用分账，清空后禁用。 |
| 权限按钮 | 通过 | 新增/编辑/删除/重试按钮均使用 `v-hasPermi`。 |
| 状态渲染 | 通过 | 分账状态使用颜色标签区分。 |
| `ShopForm.vue` 绑定时机 | **需关注** | `bindProfitSharingRecipient()` 在 `updateShop()` 之后单独调用，若 `updateShop` 成功但绑定失败，则出现店铺更新成功但分账状态未保存的不一致。建议将绑定操作纳入同一提交流程或在前端做补偿提示。 |

---

## 3. 关键问题

1. **收款人删除未校验绑定状态（需求/合同明确要求的错误码 `PROFIT_RECIPIENT_BOUND` 未触发）**
   - 文件：`backend/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitrecipient/ProfitRecipientServiceImpl.java`
   - 当前实现：`profitRecipientMapper.deleteById(id)` 直接删除。
   - 建议：删除前查询 `yshop_store_shop` 是否存在 `profit_sharing_recipient_id = id`，若存在则抛出 `PROFIT_RECIPIENT_BOUND`。

2. **支付前未拒绝缺少分账配置的订单（AC-3 要求支付拒绝，而非支付成功后拒绝）**
   - 文件：`backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java`
   - 当前实现：仅在 `pay()` 中根据店铺启用状态设置 `pay_mode=delay`，未在支付前校验平台/店铺收款人是否有效；`createProfitSharingOrder()` 在 `paySuccess()` 中抛 `PROFIT_SHARING_PAY_DISABLED`。
   - 建议：在 `pay()` 的 `ADAPAY` 分支中，若店铺启用分账，则提前调用 `ProfitRecipientApi` 校验平台收款人与店铺绑定收款人，缺失时直接拒绝支付。

3. **分账核心逻辑在 Service 与 Job 中重复**
   - 文件：`ProfitSharingOrderServiceImpl.java`、`ProfitSharingSettlementJob.java`
   - 当前实现：两者均独立构造 Adapay 参数、调用 SDK、更新状态、记录日志。
   - 建议：将公共执行逻辑抽取到 `ProfitSharingOrderServiceImpl.executeSharing(orderDO)`，`Job` 直接调用，避免维护两套状态机。

4. **`-biz` 模块之间仍存在直接依赖**
   - 文件：`backend/yshop-module-mall/yshop-module-order-biz/pom.xml`、`backend/yshop-module-mall/yshop-module-store-biz/pom.xml`
   - 当前实现：两者均依赖 `yshop-module-pay-biz`。
   - 建议：移除对 `pay-biz` 的直接依赖，仅保留 `pay-api`。

5. **Job 日志写入租户 ID 来源不一致**
   - 文件：`ProfitSharingSettlementJob.java`
   - 当前实现：`saveLog` 从 DB 读取订单的 `tenant_id`。
   - 建议：在 `@TenantJob` 上下文中使用 `TenantContextHolder.getTenantId()`，保证与当前执行租户一致。

---

## 4. 建议

1. **后端补充单元/集成测试**
   - 至少覆盖：
     - 收款人创建/更新时的角色唯一性；
     - 收款人删除的绑定校验（修复后）；
     - 分账订单创建金额校验与幂等；
     - `executeSharing` 成功/失败状态流转；
     - Job 回退 RevenueJob 的逻辑。

2. **后端校验补强**
   - `memberId` 增加正则校验（英文/数字/下划线）。
   - `ProfitRecipientServiceImpl.updateProfitRecipient` 增加 `memberId` 变更时的唯一性校验。
   - `ShopBindProfitRecipientReqVO`/`ReqDTO` 的 `recipientId` 在 `enabled=true` 时使用 `@NotNull` 组校验，当前依赖业务层判断，可接受但建议显式化。

3. **金额格式化**
   - 与 Adapay 交互的金额统一使用 `setScale(2, RoundingMode.HALF_UP).toPlainString()`，避免 `BigDecimal.toString()` 产生科学计数法或多余小数位。

4. **前端一致性**
   - `ProfitSharingRecord/index.vue` 中“店铺名称”使用 `shopName` 模糊搜索，但后端分页接口 `ProfitSharingOrderPageReqVO` 无 `shopName` 字段，当前查询会忽略该条件。建议后端增加 `shopName` 模糊查询或前端移除该搜索项。

5. **错误码统一**
   - `ProfitRecipientServiceImpl` 中部分错误码使用硬编码 `new ErrorCode(1008009xxx, ...)`，建议统一纳入 `ErrorCodeConstants` 常量管理。

---

## 5. 审查人

Review Agent (Claude Code)
