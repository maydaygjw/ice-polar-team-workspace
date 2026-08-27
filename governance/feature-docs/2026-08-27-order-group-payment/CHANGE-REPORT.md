# 拼单支付变更报告

## 业务结果

- 支持一个订单由发起人和其他登录用户共同支付，支持一次支付一份或多份。
- 发起人必须先支付一份；总份数限制为 2～10，每份最低 0.10 元，尾差归最后一份。
- 拼满后主订单继续原有履约流程；超时或发起人取消时关闭订单并退回已支付金额。
- 用户侧仅发起人可申请退款，退款按所有成功支付记录原路退回。

## 影响仓库

- `backend`：订单拼单状态、份数预占、AdaPay 支付尝试、回调汇总、超时/取消/退款和数据库迁移。
- `admin`：门店拼单配置三态；租户参数继续使用现有字符型参数页面。
- `miniapp`：N/A，本期未修改。

## 契约与迁移

- 不新增拼单支付明细表，扩展 `pay_out_order_no`。
- 新增订单拼单字段、支付人/支付尝试字段、退款字段和门店覆盖字段。
- 新增租户参数：`order.group-payment.enabled`、`order.group-payment.timeout-minutes`。
- 迁移脚本：`backend/sql/upgrade-2026-08-27-order-group-payment.sql`。

## 验证

- 后端编译、AdaPay 单号定向测试、管理端开发构建通过。
- 全量测试和全量类型检查受仓库既有基线问题影响，详见 `test-notes.md`。

## 建议 PR 标题

`feat(order): support multi-payer group payment`
