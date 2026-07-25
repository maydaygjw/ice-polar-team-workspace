# E2E 测试方案 — Adapay 第三方支付集成

## 范围

覆盖 Adapay 支付主流程、待支付订单重复调用支付接口时 `outPayNo` 递增、`pay_out_order_no` 当前有效记录唯一、回调幂等、管理后台展示，以及 Adapay 已支付订单全额退款、未支付订单取消（本地状态更新，不调用 Adapay 关闭）、退款/关闭回调幂等。

## 环境前置条件

| 项 | 要求 |
|---|---|
| 后端服务 | `yshop-drink` 后端已启动，Adapay 分支 `feat/adapay-payment` 已部署 |
| 管理后台 | `yshop-drink-vue` admin 端已启动并可登录 |
| 数据库 | MySQL 已执行 `sql/upgrade-2026-07-09-adapay-out-pay-no.sql`，`pay_out_order_no` 表存在 |
| 租户配置 | 测试租户（建议 tenantId=153）已配置 Adapay 商户参数：应用 ID、商户号、公私钥、签名方式、回调地址 |
| Adapay 环境 | 可访问 Adapay 沙箱或 mock 网关；回调可到达测试环境的 `/app-api/order/notify/payBackadapay_h5{tenantId}.json` |
| 测试数据 | 已存在待支付订单，未锁定支付渠道 |
| 网络/回调 | 若使用本地环境，需配置 Adapay 回调到可访问的公网地址或代理（如 ngrok） |

## 用例清单

| 编号 | 名称 | 文件 | 状态 |
|---|---|---|---|
| ADAPAY-E2E-001 | Adapay 支付主流程（创建支付单 → 回调成功 → 订单已支付） | `test/e2e/adapay/adapay_pay_flow.spec.js` | 待实现 |
| ADAPAY-E2E-002 | Adapay 待支付订单重复 pay 时 outPayNo 递增且旧记录失效 | `test/e2e/adapay/adapay_retry_out_pay_no.spec.js` | 待实现 |
| ADAPAY-E2E-003 | Adapay 回调幂等（重复回调不重复履约） | `test/e2e/adapay/adapay_notify_idempotency.spec.js` | 待实现 |
| ADAPAY-E2E-004 | 管理后台订单列表/详情展示 Adapay 支付方式 | `test/e2e/adapay/adapay_admin_display.spec.js` | 待实现 |
| ADAPAY-E2E-005 | 已支付订单不允许再次支付 | `test/e2e/adapay/adapay_paid_order_repay.spec.js` | 待实现 |
| ADAPAY-E2E-006 | 渠道锁定：Adapay 订单不可切换为微信/支付宝 | `test/e2e/adapay/adapay_channel_lock.spec.js` | 待实现 |
| ADAPAY-E2E-007 | Adapay 已支付订单全额退款成功 | `test/e2e/adapay/adapay_refund_full.spec.js` | 待实现 |
| ADAPAY-E2E-008 | 已分账确认订单退款被拒绝 | `test/e2e/adapay/adapay_refund_after_sharing.spec.js` | 待实现 |
| ADAPAY-E2E-009 | 未支付 Adapay 订单取消（本地状态更新，不调用 Adapay 关闭） | `test/e2e/adapay/adapay_cancel_unpaid.spec.js` | 待实现 |
| ADAPAY-E2E-010 | 退款/关闭回调幂等 | `test/e2e/adapay/adapay_refund_close_notify_idempotency.spec.js` | 待实现 |

## 断言方式

### ADAPAY-E2E-001 主流程

1. 调用 `POST /app-api/order/pay`（`paytype=adapay`）返回成功，断言：
   - HTTP 状态码 200
   - 响应体包含 `data` 支付参数（如 `pay_url` 或 `payment_info`）
2. 查询数据库 `pay_out_order_no`，断言：
   - 存在一条 `order_id = {orderId}`、`pay_type = adapay`、`out_pay_no = {orderId}-1`、`status = 0` 的记录
3. 模拟 Adapay 回调 `POST /app-api/order/notify/payBackadapay_h5{tenantId}.json`，断言：
   - 回调返回 HTTP 200
4. 轮询订单状态，断言：
   - 订单 `status` 变为已支付
   - 订单 `pay_type` = `adapay`
   - `pay_out_order_no.status` = 1
5. 断言后续履约动作触发（如库存扣减、权益发放记录存在）。

### ADAPAY-E2E-002 待支付订单重复 pay 时 outPayNo 递增

1. 对同一订单首次调用 `POST /app-api/order/pay`（`paytype=adapay`），记录 `outPayNo = {orderId}-1`。
2. 不完成支付，再次发起支付请求，断言：
   - 接口返回成功
   - 数据库新增 `pay_out_order_no` 记录，`out_pay_no = {orderId}-2`
   - 上一条 `{orderId}-1` 不再是当前有效待支付记录（例如 `status = 2`）
   - 同一 `order_id + pay_type = adapay` 下 `status = 0` 的记录数为 1
3. 再次发起支付，断言 `out_pay_no = {orderId}-3`，且只有 `{orderId}-3` 为当前有效待支付记录。
4. 对任一历史 `outPayNo` 发起成功回调，订单最多完成一次支付履约，库存、权益、订单日志不重复产生。

### ADAPAY-E2E-003 回调幂等

1. 完成 ADAPAY-E2E-001 的前两步，生成 `outPayNo`。
2. 使用相同回调报文连续发送 3 次到 `POST /app-api/order/notify/payBackadapay_h5{tenantId}.json`，断言：
   - 3 次均返回 HTTP 200
3. 查询履约相关记录（库存、权益、订单日志），断言：
   - 只产生 1 次扣减/发放
   - 订单状态未发生额外变更
   - 无重复 MQ 消费导致的异常日志

### ADAPAY-E2E-004 管理后台展示

1. 登录管理后台。
2. 进入订单列表，搜索 Adapay 支付订单，断言：
   - 列表中支付方式显示为“Adapay支付”。
3. 进入订单详情，断言：
   - 支付方式字段显示为“Adapay支付”。

### ADAPAY-E2E-005 已支付订单不允许再次支付

1. 完成 ADAPAY-E2E-001 使订单已支付。
2. 再次调用 `POST /app-api/order/pay`（`paytype=adapay`），断言：
   - 接口返回错误，提示订单已支付或状态不允许支付。

### ADAPAY-E2E-006 渠道锁定

1. 对订单调用 `POST /app-api/order/pay`（`paytype=adapay`）创建支付单。
2. 再调用 `POST /app-api/order/pay`（`paytype=weixin` 或 `alipay`），断言：
   - 接口返回错误，提示已选择支付渠道，不可切换。

### ADAPAY-E2E-007 已支付订单全额退款成功

1. 完成 ADAPAY-E2E-001 使订单已支付，记录 `outPayNo`。
2. 调用 `POST /admin-api/order/store-order/refund`（或 `/cancelAndRefund`），断言：
   - HTTP 状态码 200。
3. 查询订单日志表 `yshop_store_order_status`，断言：
   - 存在 `change_type = refund_price_success` 或等价的退款成功记录。
4. 查询订单状态，断言：
   - `refund_status = 2`，`status = -2`。
5. 断言库存、优惠券、门店收支、佣金回滚正确。

### ADAPAY-E2E-008 已分账确认订单退款被拒绝

1. 完成 ADAPAY-E2E-001 使订单已支付，且 `profit_sharing_order.sharing_status` 为 `SUCCESS` 或 `PROCESSING`。
2. 调用 `POST /admin-api/order/store-order/refund`，断言：
   - 接口返回错误，错误码为 `ADAPAY_REFUND_NOT_ALLOWED_AFTER_SHARING`。
3. 查询订单日志表 `yshop_store_order_status`，断言：
   - 不存在该订单的退款成功记录；`refund_status` 保持原状。

### ADAPAY-E2E-009 未支付 Adapay 订单取消

1. 对订单调用 `POST /app-api/order/pay`（`paytype=adapay`），生成 `outPayNo`，不完成支付。
2. 调用 `POST /app-api/order/cancel`（或站点取消/超时 Job 触发），断言：
   - HTTP 状态码 200。
   - 订单本地状态更新为已取消/已退款，库存、优惠券回退。
3. 不调用 Adapay 关闭接口；Adapay 侧支付单保持原状，由 Adapay 超时自动关闭。
4. 模拟 Adapay `CLOSED` 回调（若后续收到），断言：
   - 回调返回 HTTP 200。
   - 对应 `pay_out_order_no` 记录 `status = 2`，无异常。

### ADAPAY-E2E-010 退款/关闭回调幂等

1. 完成 ADAPAY-E2E-007 使订单已退款，或完成 ADAPAY-E2E-009 生成关闭记录。
2. 使用相同回调报文连续发送 3 次到 `POST /app-api/order/notify/payBackadapay_h5{tenantId}.json`，断言：
   - 3 次均返回 HTTP 200。
3. 查询订单日志表 `yshop_store_order_status` 与 `pay_out_order_no`，断言：
   - 退款/关闭相关日志只产生 1 条有效记录。
   - 无重复流水、无重复状态变更。

## 测试数据与清理

- 每个用例使用独立订单，避免状态串扰。
- 用例结束后清理：
  - 逻辑删除测试产生的 `pay_out_order_no` 记录，或标记为测试数据。
  - 回滚测试订单状态到初始待支付（仅在允许的环境）。
  - 删除测试产生的履约副作用记录。

## 风险与依赖

- Adapay 沙箱回调可能延迟或需要手动触发，建议用 mock 回调替代真实网关。
- 若本地无法接收回调，需提前配置代理或直接用后端接口模拟回调。
- 管理后台用例依赖前端已合并 Adapay 展示文案。
- 退款/关闭用例依赖 Adapay 沙箱支持退款接口，或需要可 mock 的网关；已分账订单退款拒绝用例依赖 `profit_sharing_order` 数据。未支付订单取消用例不调用 Adapay 关闭接口。
