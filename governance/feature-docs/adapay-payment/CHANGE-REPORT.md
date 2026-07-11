# Adapay 第三方支付集成 — 变更报告

## 1. 业务目标

为 yshop-drink 后端与 yshop-drink-vue 管理后台新增 Adapay（汇付天下）第三方支付能力，支持：

- 调用方通过统一支付接口使用 Adapay 完成订单支付。
- 支付成功后订单状态更新为已支付，并触发后续履约流程。
- 管理后台可配置 Adapay 商户参数，并在订单视图中正确展示“Adapay支付”。
- 通过引入 `outPayNo` 外部支付单号映射层，解决 Adapay 不允许同一订单号重复发起支付的问题。
- Adapay 待支付订单每次重新调用支付接口都必须生成新的 `outPayNo`，并关闭上一条当前有效待支付 attempt。
- 同一订单一旦使用某渠道发起支付，即锁定为该渠道，不可切换为其他支付渠道。
- 对 Adapay 已支付订单发起全额退款，资金原路返回。
- 对 Adapay 未支付订单执行支付撤销（关闭 Adapay 侧支付单），避免脏单误履约。
- 接收并处理 Adapay 退款/关闭异步通知，保证回调幂等。

---

## 2. 影响仓库与文件

### 2.1 后端仓库（backend-adapay-payment / feat/adapay-payment）

| 文件路径 | 变更说明 |
|----------|----------|
| `yshop-framework/yshop-common/src/main/java/co/yixiang/yshop/framework/common/enums/PayIdEnum.java` | 新增 `ADAPAY_H5("adapay_h5", "Adapay支付H5")` |
| `yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/PayTypeEnum.java` | 新增 `ADAPAY("adapay", "Adapay支付")` |
| `yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/ErrorCodeConstants.java` | 新增 Adapay 相关错误码与 `PAY_TYPE_LOCKED` |
| `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderService.java` | `paySuccess` 扩展为 4 参数接口 |
| `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java` | 新增 Adapay 支付分支、分账校验与挂起、outPayNo 成功标记、渠道锁定校验 |
| `yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/mq/consumer/PayNoticeConsumer.java` | 透传 `adapayPaymentId`、`outPayNo` |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/config/handlers/AdapayPayMessageHandler.java` | 新增 Adapay 回调处理器 |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/config/MerchantPayServiceConfigurer.java` | 注册 Adapay 回调处理器 |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/mq/message/PayNoticeMessage.java` | 扩展 `adapayPaymentId`、`outPayNo` 字段 |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/mq/producer/PayNoticeProducer.java` | 新增三/四参数重载 |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java` | 新增 `OUT_PAY_NO_GENERATE_FAILED` |
| `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/api/payoutorderno/PayOutOrderNoApi.java` | 新增 API 接口 |
| `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/api/payoutorderno/PayOutOrderNoApiImpl.java` | API 实现 |
| `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/dal/dataobject/payoutorderno/PayOutOrderNoDO.java` | 新增 DO |
| `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/dal/mysql/payoutorderno/PayOutOrderNoMapper.java` | 新增 Mapper |
| `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/payoutorderno/PayOutOrderNoService.java` | 新增 outPayNo 生成/查询/状态更新服务 |
| `yshop-module-pay/yshop-module-pay-api/pom.xml` | 新增 `com.holuntech:pay-java-adapay:2.14.14-SNAPSHOT` 依赖 |
| `sql/upgrade-2026-07-09-adapay-out-pay-no.sql` | 新增 `pay_out_order_no` 表及回滚语句 |
| `yshop-module-order-biz/.../service/storeorder/StoreOrderServiceImpl.java` | `orderRefund(...)` 新增 `ADAPAY` 分支：分账状态校验、已支付 outPayNo 查询、Adapay 退款调用；用户取消/超时不再触发 Adapay 关闭 |
| `yshop-module-pay-api/.../config/handlers/AdapayPayMessageHandler.java` | 扩展 `CLOSED/REFUND_PROCESSING/REFUND_SUCCESS/REFUND_FAILED` 状态处理 |
| `yshop-module-pay-biz/.../service/payoutorderno/PayOutOrderNoService.java` | 新增 `findPaidByOrderIdAndPayType` 供退款查询 |
| `yshop-module-pay-api/.../api/payoutorderno/PayOutOrderNoApi.java` | 回调 API 精简：移除 DO 暴露，新增 `markClosedByOutPayNo`、`findPaidOutPayNoByOrderIdAndPayType` |
| `yshop-module-order-api/.../order/enums/ErrorCodeConstants.java` | 新增 `ADAPAY_REFUND_FAILED`、`ADAPAY_CLOSE_FAILED`、`ADAPAY_REFUND_NOT_ALLOWED_AFTER_SHARING`、`ADAPAY_REFUND_CALLBACK_INVALID`、`ORDER_REFUND_NOT_ADAPAY` |

### 2.2 管理后台仓库（admin-adapay-payment / feat/adapay-payment）

| 文件路径 | 变更说明 |
|----------|----------|
| `src/utils/constants.ts` | `PayChannelEnum` 新增 `ADAPAY_H5`，`PayType` 新增 `ADAPAY` |
| `src/views/pay/merchantDetails/MerchantDetailsForm.vue` | 支付类型、支付 ID 下拉框新增 Adapay 选项 |
| `src/views/mall/order/storeOrder/index.vue` | 支付方式筛选与列表展示新增 Adapay |
| `src/views/mall/order/storeOrder/OrderDetail.vue` | 订单详情支付方式展示新增 Adapay |
| `src/views/mall/desk/shopDesk/Order.vue` | 店内订单支付方式筛选/展示新增 Adapay |
| `src/views/mall/cashier/settlement.vue` | 收银台支付方式新增 Adapay |
| `src/views/mall/cashier/settlement2.vue` | 收银台（版本2）支付方式新增 Adapay |
| `src/views/score/order/index.vue` | 积分订单列表展示新增 Adapay |
| `src/views/site/order/OrderDetail.vue` | 服务订单详情新增 `payTypeLabel` 映射含 Adapay |

---

## 3. 契约变化

### 3.1 端点

- `POST /app-api/order/pay`：请求参数 `paytype` 新增合法值 `adapay`。
- `POST /app-api/order/notify/payBack{detailsId}.json`：Adapay 回调路径为 `payBackadapay_h5{tenantId}.json`。
- Admin 商户配置端点：`payType`/`detailsId` 新增 Adapay 相关枚举值。

### 3.2 枚举

- `PayTypeEnum.ADAPAY`：`value = "adapay"`，`desc = "Adapay支付"`。
- `PayIdEnum.ADAPAY_H5`：`value = "adapay_h5"`，`desc = "Adapay支付H5"`。

### 3.3 MQ 消息

Topic `order.pay.notice` Payload 扩展：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `orderId` | String | 是 | 系统订单号 |
| `payType` | String | 否 | `adapay` 时表示 Adapay |
| `adapayPaymentId` | String | 否 | Adapay 支付对象 ID |
| `outPayNo` | String | 否 | 外部支付单号 |

### 3.4 错误码

| 错误码 | 含义 | 状态 |
|--------|------|------|
| `OUT_PAY_NO_GENERATE_FAILED` | 外部支付单号生成失败 | 已使用 |
| `PAY_TYPE_LOCKED` | 订单已使用其他支付渠道发起，无法切换 | 已使用 |
| `ADAPAY_PAYMENT_QUERY_FAILED` | Adapay 支付单查询失败 | 已定义，当前未使用 |
| `ADAPAY_PAYMENT_STATUS_INVALID` | Adapay 支付单状态异常，请重新下单 | 已定义，当前未使用 |
| `ADAPAY_PAYMENT_DUPLICATE_ORDER` | 订单已发起支付，请刷新订单状态 | 已定义，当前未使用 |

### 3.5 退款/支付撤销契约

- **复用端点**：
  - `POST /admin-api/order/store-order/refund`：同意 Adapay 订单全额退款。
  - `POST /admin-api/order/store-order/cancelAndRefund`：取消并全额退款。
  - `POST /app-api/order/cancel`、`POST /app-api/site/order/cancel/{orderId}`：未支付订单取消时仅更新本地状态，不调用 Adapay 关闭。
  - `POST /app-api/order/notify/payBackadapay_h5{tenantId}.json`：退款/关闭异步回调复用现有回调端点。
- **不新增枚举**：复用 `OrderInfoEnum.REFUND_STATUS_*` 表达订单退款状态。
- **不新增表**：退款结果与现有微信/支付宝一致，通过订单 `refund_status` 与订单日志表 `yshop_store_order_status` 表达。
- **关键约束**：
  - 仅支持全额退款。
  - 已分账确认（`profit_sharing_order.sharing_status = SUCCESS/PROCESSING`）订单禁止退款。
  - 同步返回 `SUCCESS/PROCESSING` 即更新订单为已退款。
- **新增错误码**：`ADAPAY_REFUND_FAILED`、`ADAPAY_CLOSE_FAILED`、`ADAPAY_REFUND_NOT_ALLOWED_AFTER_SHARING`、`ADAPAY_REFUND_CALLBACK_INVALID`、`ORDER_REFUND_NOT_ADAPAY`。

---

## 4. 数据库迁移

- **脚本**：`sql/upgrade-2026-07-09-adapay-out-pay-no.sql`
- **新增表**：`pay_out_order_no`
- **字段**：`id`, `tenant_id`, `order_id`, `out_pay_no`, `pay_type`, `status`, `deleted`, `create_time`, `update_time`
- **索引**：
  - `uk_tenant_out_pay_no` (`tenant_id`, `out_pay_no`) 唯一
  - `idx_tenant_order_id` (`tenant_id`, `order_id`)
  - `idx_tenant_pay_type_order_id` (`tenant_id`, `pay_type`, `order_id`)
- **回滚**：`DROP TABLE IF EXISTS pay_out_order_no;`

---

## 5. 关键阻塞问题状态

| 问题 | 原状态 | 当前状态 | 说明 |
|------|--------|----------|------|
| 渠道锁定未实现 | 阻塞 | 已修复 | `AppStoreOrderServiceImpl.pay()` 增加 `checkPayTypeLocked()`，对微信/Adapay 互切及同一渠道重复发起做了校验。 |
| Adapay 待支付重复 pay 复用旧 outPayNo | 新发现 | 已修复 | `PayOutOrderNoService.prepareAdapayOutPayNo` 关闭旧 attempt 并生成新 `outPayNo`。 |
| 用户取消/超时未支付订单触发 Adapay 关闭 | 已变更 | 已按用户反馈调整 | 用户取消未支付订单不再调用 Adapay 关闭，仅本地更新状态；支付撤销仅用于退款场景。 |
| 重新支付前调用 Adapay 关闭旧单 | 已变更 | 已按用户反馈调整 | 重新支付前仅将本地旧 `pay_out_order_no` 置为 `status=2`，无需调用 Adapay 关闭。 |

---

## 6. 测试结果

- 后端 `mvn clean compile -DskipTests` 通过（2026-07-11）。
- 全量 `mvn test` 未执行；历史存在 `DesensitizeTest` 等无关失败。
- 未发现针对 `PayOutOrderNoService` 或 Adapay 退款流程的新增单元测试，建议后续补充。
- E2E 测试方案已更新（`test_plan.md`），取消未支付订单用例改为本地状态更新。
- 建议优先完成以下用例后再合并：
  - ADAPAY-E2E-001 主流程
  - ADAPAY-E2E-002 待支付重复 pay 时 outPayNo 递增且旧记录失效
  - ADAPAY-E2E-003 回调幂等
  - ADAPAY-E2E-006 渠道锁定
  - ADAPAY-E2E-007 已支付订单全额退款成功
  - ADAPAY-E2E-008 已分账确认订单退款被拒绝
  - ADAPAY-E2E-009 未支付订单取消（本地状态更新）
  - ADAPAY-E2E-010 退款/关闭回调幂等

---

## 7. 风险

| 风险 | 等级 | 说明 | 缓解措施 |
|------|------|------|----------|
| Adapay 重复 pay 复用旧 outPayNo | 高 | 待支付订单再次发起支付时可能向 Adapay 重复提交旧外部订单号，触发 orderId 重复错误 | 修复支付入口：关闭旧 `status=0` attempt 后生成新的 `orderId-{n+1}`；补充 ADAPAY-E2E-002 |
| outPayNo 并发重复 | 中 | 高并发下可能生成相同序号 | 唯一索引 + 重试机制已覆盖 |
| 回调验签失败 | 中 | Adapay SDK 适配层验签配置错误会导致回调被拒 | 沙箱环境验证，运维文档明确配置 |
| 错误码与实现不一致 | 低 | 部分错误码未使用 | 同步契约文档或移除未使用常量 |
| 管理后台硬编码映射 | 低 | 多处 `v-if` 映射，后续渠道扩展易遗漏 | 抽成统一组件/过滤器 |
| 用户取消未支付订单未关闭 Adapay 侧支付单 | 低 | 用户取消时本地不调用 Adapay 关闭，Adapay 侧支付单可能超时前仍有效 | 支付回调以订单最终状态幂等；重新支付使用新 outPayNo |
| 分账状态校验遗漏导致错误退款 | 高 | 已分账确认订单若未拦截，Adapay 退款可能失败或资金异常 | 退款前强制查询 `profit_sharing_order`，`SUCCESS/PROCESSING` 状态直接拒绝 |
| Adapay 退款/关闭状态理解偏差 | 高 | `AdapayRefundResult`、`AdapayStatus` 状态语义未确认前易导致错误分支 | 实现前确认 SDK 状态枚举与返回值 |
| 退款回调幂等处理不当 | 中 | 重复或乱序回调可能导致重复回滚库存/佣金 | 以订单 `refund_status = 2` 为幂等边界，重复回调仅记录订单日志 |
| 关闭调用失败导致 Adapay 脏单 | 中 | 退款场景调用 Adapay 关闭失败时，Adapay 侧可能仍有脏单 | 关闭失败记录告警日志，本地幂等处理 |
| 同一 outPayNo 重复退款 | 中 | 并发或重复请求可能产生多笔退款 | 退款前校验订单 `refund_status`，已退款订单直接幂等返回 |
| 退款回调未记录订单日志 | 低 | 当前退款成功回调仅记录应用日志，未写入 `yshop_store_order_status` | 如需审计可后续补充 |
---

## 8. 建议 PR 标题与描述

### PR 标题

```
feat(pay/order/admin): Adapay 第三方支付集成
```

### PR 描述

```
## 变更摘要
- 后端：新增 Adapay 支付渠道，复用统一支付与回调入口。
- 引入 pay_out_order_no 外部支付单号映射层：微信 outPayNo=orderId，Adapay 按 orderId-{n} 递增。
- 新增渠道锁定：同一订单使用微信/Adapay 任一渠道发起后，不可切换为另一渠道。
- 扩展 PayTypeEnum / PayIdEnum / PayNoticeMessage / PayNoticeProducer 契约。
- 管理后台：支付配置、订单列表、订单详情、收银台等视图新增 Adapay 选项与文案。
- 新增 Adapay 全额退款：复用现有退款入口，生成独立 outRefundNo，同步更新订单状态。
- 退款前校验分账状态，已分账确认（SUCCESS/PROCESSING）订单直接拒绝。
- 扩展 Adapay 回调处理器，支持 CLOSED / REFUND_PROCESSING / REFUND_SUCCESS / REFUND_FAILED 状态。
- 用户取消未支付订单与重新支付前不再调用 Adapay 关闭，仅本地更新 pay_out_order_no 状态。

## 数据库
- 执行 sql/upgrade-2026-07-09-adapay-out-pay-no.sql 新建 pay_out_order_no 表。
- 退款/关闭不新增数据库表，复用订单 `refund_status` 与订单日志表。

## 已知待优化
- [ ] 移除未使用的 Adapay 错误码常量，或恢复对应查询/复用逻辑。
- [ ] 回调非成功状态时关闭对应 outPayNo 记录。
- [ ] paySuccess 中 System.out.println 改为日志。
- [ ] 已分账确认订单退款由后续需求支持分账回退后放开。
- [ ] 退款/关闭回调可考虑写入 `yshop_store_order_status` 订单日志表，便于审计。

## 测试
- [ ] 完成后端单元测试与 E2E 用例（ADAPAY-E2E-001/002/003/006/007/009/010）。

## 相关文档
- governance/feature-docs/adapay-payment/requirements-spec.md
- governance/feature-docs/adapay-payment/technical-design.md
- governance/feature-docs/adapay-payment/contract-changes.md
- governance/feature-docs/adapay-payment/review-report.md
- governance/feature-docs/adapay-payment/CHANGE-REPORT.md
- governance/ADR/adr-003-adapay-out-pay-no.md
- governance/ADR/adr-004-adapay-refund-and-close.md
```

---

## 9. 审查结论

变更范围与契约文档大体一致，基础支付链路、outPayNo 映射层、渠道锁定、管理后台展示、DB 迁移均已落地。Adapay 退款分支、回调处理及分账状态校验已实现并通过编译。用户取消未支付订单与重新支付场景已按反馈调整为仅本地更新状态，不调用 Adapay 关闭。

**当前状态：实现完成，待补充单元测试与 E2E 验证后可合并。**
