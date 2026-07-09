# Adapay 第三方支付集成 — 审查报告

## 审查范围

- 需求规格：requirements-spec.md
- 技术设计：technical-design.md
- 契约变更：contract-changes.md
- ADR：adr-003-adapay-out-pay-no.md
- 后端实现：/Users/gejunwen/code/holun-team/ice-polar-team-workspace/.worktrees/backend-adapay-payment
- 管理后台实现：/Users/gejunwen/code/holun-team/ice-polar-team-workspace/.worktrees/admin-adapay-payment
- 测试方案：test_plan.md

审查日期：2026/07/09

---

## 1. 通过项

### 1.1 需求与 Use Cases

| 检查点 | 结论 | 说明 |
|--------|------|------|
| 后端新增 Adapay 支付能力 | 通过 | `AppStoreOrderServiceImpl.pay()` 新增 `ADAPAY` 分支，调用 Adapay SDK 创建支付单。 |
| 支付成功后订单状态更新 | 通过 | `paySuccess()` 将订单 `paid` 置为 1，`payType` 记录为 `adapay`，并写库存、权益、流水、抽成、分账挂起等后续履约。 |
| 管理后台配置 Adapay | 通过 | `MerchantDetailsForm.vue` 已新增 Adapay 支付类型与 `adapay_h5{tenantId}` 支付 ID。 |
| 管理后台展示 Adapay 文案 | 通过 | 订单列表、订单详情、店内订单、积分订单、服务订单详情、收银台等视图已统一展示“Adapay支付”。 |
| 回调异步通知链路 | 通过 | `AdapayPayMessageHandler` 校验状态后通过 Redis Stream `order.pay.notice` 异步投递。 |
| 渠道锁定 | 通过 | `pay()` 中新增 `checkPayTypeLocked()`，对微信/Adapay 互切以及同一渠道重复发起做了校验。 |

### 1.2 技术设计与架构决策

| 检查点 | 结论 | 说明 |
|--------|------|------|
| 复用现有支付抽象 | 通过 | 复用 `/app-api/order/pay`、回调端点、`merchant_details` 配置表、`order.pay.notice` 链路。 |
| outPayNo 映射层 | 通过 | 新增 `pay_out_order_no` 表与 `PayOutOrderNoService`，微信 `outPayNo = orderId`，Adapay 为 `orderId-{递增序号}`。 |
| outPayNo 生成规则 | 通过 | 取同一订单下 Adapay 记录最大序号 +1，唯一索引兜底，冲突时重试。 |
| 微信支付兼容性 | 通过 | 微信支付分支已调用 `generateOutPayNo(param.getUni(), "weixin")`，保持 `outPayNo = orderId`，并在 `pay_out_order_no` 留痕。 |
| 回调反查 | 通过 | `AdapayPayMessageHandler` 通过 `outPayNo` 反查 `orderId`，不依赖回调参数中的系统订单号。 |
| MQ 扩展 | 通过 | `PayNoticeMessage` 增加 `adapayPaymentId`、`outPayNo` 字段；`PayNoticeProducer` 提供三/四参数重载。 |

### 1.3 契约变更落地

| 检查点 | 结论 | 说明 |
|--------|------|------|
| DB 表 | 通过 | `pay_out_order_no` 表已创建，含 `tenant_id`、`order_id`、`out_pay_no`、`pay_type`、`status`、审计字段。 |
| 索引 | 通过 | 唯一索引 `uk_tenant_out_pay_no`、普通索引 `idx_tenant_order_id`、`idx_tenant_pay_type_order_id` 已建立。 |
| 枚举 | 通过 | `PayTypeEnum.ADAPAY`、`PayIdEnum.ADAPAY_H5` 已新增。 |
| MQ Topic | 通过 | `order.pay.notice` 消息体扩展字段已落地。 |
| API 端点 | 通过 | 复用现有 app/admin 端点，未新增独立端点。 |
| 错误码 | 部分通过 | `OUT_PAY_NO_GENERATE_FAILED`、`PAY_TYPE_LOCKED` 已使用；`ADAPAY_PAYMENT_QUERY_FAILED`、`ADAPAY_PAYMENT_STATUS_INVALID`、`ADAPAY_PAYMENT_DUPLICATE_ORDER` 已定义但当前代码未使用。 |

### 1.4 租户隔离

| 检查点 | 结论 | 说明 |
|--------|------|------|
| pay_out_order_no 查询 | 通过 | `PayOutOrderNoMapper` 所有查询均显式带 `tenant_id`；`PayOutOrderNoService`/`ApiImpl` 从 `TenantContextHolder` 取租户。 |
| 回调处理 | 通过 | `AdapayPayMessageHandler` 通过 `TenantContextHolder` 隐式过滤（`PayOutOrderNoApiImpl` 取当前租户查）。 |

### 1.5 安全扫描

| 检查点 | 结论 | 说明 |
|--------|------|------|
| 硬编码密钥 | 通过 | 新代码未出现硬编码密钥/私密配置；商户参数通过 `merchant_details` 表管理。 |
| SQL 注入（新代码） | 通过 | `PayOutOrderNoMapper` 使用 MyBatis Plus Wrapper，无字符串拼接 SQL。 |
| XSS（admin 新代码） | 通过 | 新增 Adapay 展示片段均使用文本插值，无 `v-html`/`innerHTML`/`eval`。 |

### 1.6 迁移脚本

| 检查点 | 结论 | 说明 |
|--------|------|------|
| 脚本存在 | 通过 | `sql/upgrade-2026-07-09-adapay-out-pay-no.sql` 存在，按规范命名。 |
| 含回滚语句 | 通过 | 脚本末尾提供 `DROP TABLE IF EXISTS pay_out_order_no;` 回滚注释。 |
| 不修改基线文件 | 通过 | 未直接修改 `sql/yixiang-drink.sql`。 |

### 1.7 分支规范

| 检查点 | 结论 | 说明 |
|--------|------|------|
| 后端分支名 | 通过 | `feat/adapay-payment`，符合设计文档约定。 |
| 管理后台分支名 | 通过 | `feat/adapay-payment`，符合设计文档约定。 |

---

## 2. 问题项

### 2.1 Adapay 错误码未实际投入使用

- **严重等级**：低
- **说明**：`ADAPAY_PAYMENT_QUERY_FAILED`、`ADAPAY_PAYMENT_STATUS_INVALID`、`ADAPAY_PAYMENT_DUPLICATE_ORDER` 在最新提交中对应的复用逻辑已被删除，但错误码常量仍保留。
- **影响**：代码中存在未引用常量，契约变更文档与实际实现出现偏差。
- **建议**：要么恢复 Adapay 支付单查询/复用逻辑，要么从 `ErrorCodeConstants` 移除未使用常量并同步更新契约文档。

### 2.2 分账金额校验逻辑存在冗余/风险

- **严重等级**：低
- **说明**：`createProfitSharingOrder` 中 `orderInfo.getPayPrice().compareTo(commissionAmount.add(shopAmount)) != 0` 在 `shopAmount = payPrice - commissionAmount` 恒成立，该校验无意义；若浮点/decimal 精度问题可能误抛异常。
- **影响**：逻辑上必然为 0，但 `BigDecimal` 未显式设置精度时，若中间计算产生精度差异会触发异常。
- **建议**：移除该校验或改为 `compareTo(BigDecimal.ZERO) == 0`，并对金额计算显式指定 `MathContext`/`setScale`。

### 2.3 订单列表查询存在 SQL 注入风险（既有代码，本次未新增但相关）

- **严重等级**：中
- **说明**：`orderList()` 使用 `wrapper.apply("FIND_IN_SET ('" + uid + "',user_ids)")` 拼接用户 ID 字符串。
- **影响**：`uid` 来自登录会话，当前为 `Long`，风险较低；但若后续类型变更或外部调用，可能引入注入。
- **建议**：优先使用 MyBatis Plus 的 `apply` 占位符写法或改为 `INSTR` 函数参数化查询。

### 2.4 回调处理缺少非成功状态的 outPayNo 关闭逻辑

- **严重等级**：低
- **说明**：Adapay 回调状态非 `PAY_SUCCESS` 时直接返回 FAIL，但未将对应 `outPayNo` 标记为关闭。设计文档中 `status` 枚举含“2 关闭”。
- **影响**：失败/关闭的支付单在 `pay_out_order_no` 中一直为 0，重新支付时会继续递增序号；虽不阻断业务，但不利于对账。
- **建议**：在回调处理非终态/失败时调用 `payOutOrderNoService.markClosed(id)`。

### 2.5 `paySuccess` 中混用 `System.out.println`

- **严重等级**：低
- **说明**：`AppStoreOrderServiceImpl.paySuccess()` 存在 `System.out.println("orderInfo:"+orderInfo.getTenantId());`。
- **影响**：生产环境应避免标准输出；应使用日志框架。
- **建议**：删除或改为 `log.info`。

---

## 3. 建议项

1. **统一支付方式展示组件**：admin 多处使用 `v-if` 硬编码支付方式映射，建议抽取为 `PayTypeLabel` 组件/过滤器，避免新增渠道时遗漏。
2. **为 `PayOutOrderNoService` 增加单元测试**：重点覆盖并发序号生成、微信记录幂等插入、回调反查租户隔离。
3. **为 Adapay 回调增加签名校验说明**：当前依赖 eGzosN 适配层验签，应在代码注释或运维文档中明确验签配置与沙箱验证步骤。
4. **E2E 用例落地**：test_plan.md 中 6 个用例当前均为“待实现”，建议在合并前至少完成主流程、幂等、渠道锁定三个用例的自动化脚本。
5. **错误码文档同步**：contract-changes.md 中的错误码列表需根据实现最终状态更新（删除未使用或补充使用位置）。
6. **考虑 `outPayNo` 关闭/过期策略**：对于长时间未支付的 Adapay 单，建议结合订单超时任务统一关闭对应 `outPayNo` 记录。

---

## 4. 总体结论

实现已满足 Adapay 支付主流程、outPayNo 映射层、渠道锁定、管理后台配置与展示等技术设计要求；租户隔离、MQ 扩展、枚举扩展、迁移脚本与回滚均已落地。原审查报告中的高优先级阻塞问题“渠道锁定未实现”已在本次复审中修复并通过。

**当前状态：通过，仍建议修复 2.1–2.5 问题项后再合并。**
