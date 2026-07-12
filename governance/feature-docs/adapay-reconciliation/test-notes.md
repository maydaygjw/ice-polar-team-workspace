# 测试记录 — Adapay 日终对账

## 编译

```bash
(cd backend && mvn compile -pl yshop-module-pay/yshop-module-pay-biz -am)
结果：BUILD SUCCESS
```

## 单元测试

```bash
mvn test -pl yshop-module-pay/yshop-module-pay-biz -am -Dtest=AdapayReconciliationServiceImplTest
结果：14 tests run, 0 failures, 0 errors, 0 skipped
```

### 测试覆盖

| 编号 | 测试方法 | 场景 | 结果 |
|------|---------|------|------|
| UT-01 | `testToCents_exactMatch` | 金额转分：1.00→100, 14.90→1490, 0.03→3 | PASS |
| UT-02 | `testToCents_oneCentDifference` | 14.90 vs 14.91 精确检测到 1 分差异 | PASS |
| UT-03 | `testToCents_rounding` | 三分位四舍五入：14.905→1491 | PASS |
| UT-04 | `testMatchPayments_allMatched` | 金额和状态完全一致 → MATCHED | PASS |
| UT-05 | `testMatchPayments_amountDiff_oneCent` | 账单 14.91 vs 本地 14.90 → AMOUNT_DIFF | PASS |
| UT-06 | `testMatchPayments_billOnly` | 账单有、本地无 → BILL_ONLY | PASS |
| UT-07 | `testMatchPayments_localOnly` | 本地有、账单无 → LOCAL_ONLY | PASS |
| UT-08 | `testMatchPayments_skipFailedTransactions` | 交易状态=F 的记录不参与匹配 | PASS |
| UT-09 | `testMatchPayments_duplicatePaymentId_notSilentlyOverwritten` | 重复 payment_id → 保留第一个 | PASS |
| UT-10 | `testParseChargeBill_parsesCorrectly` | Charge CSV 解析：正确提取字段、状态、行号 | PASS |
| UT-11 | `testParseConfirmBill_parsesCorrectly` | PaymentConfirm CSV 解析 | PASS |
| UT-12 | `testParseDivBill_multiRowsPerPayment` | Div CSV 解析：每订单 2 行 | PASS |
| UT-13 | `testParseBill_skipsCommentLines` | 注释行和合计行正确跳过 | PASS |
| UT-14 | `testMatchProfitSharings_confirmMatched` | 分账确认匹配 + 角色分摊比较 | PASS |

## 部署验证（测试环境）

- 服务器：139.196.173.216
- 租户 154 2026-07-11 对账：

| 类型 | 账单笔数 | 本地笔数 | 对平 | 结果 |
|------|---------|---------|------|------|
| PAYMENT | 6 | 7 | 4 | UNBALANCED（含 2 笔 BILL_ONLY+3 笔无 adapay_payment_id） |
| PROFIT_SHARING | 1 | 1 | 确认汇总 ✓ + 平台角色 ✓ + 店铺角色 ✓ | — |

## 开发中发现的 Bug 及修复

| Bug | 原因 | 修复 |
|-----|------|------|
| `queryLocalPayments` 只查到 1 条 | 查了 `profit_sharing_order` 表而非 `pay_out_order_no` | 改为 JOIN `pay_out_order_no` + `yshop_store_order` |
| 账单匹配数始终为 0 | Adapay SDK 返回 ZIP URL JSON 而非 CSV | `resolveBillContent()` 下载 ZIP 解压 CSV |
| 平台分账 `bill=0.00` | Div `div_user` 是 MemberId 不是 `"0"` | 改用 `fee_bearer=Y/N` 区分平台/店铺 |
| 明细含所有租户交易 | 未按 app_id 过滤 | Charge/PaymentConfirm 按 `app_id` 过滤 |
| `duration_ms` 负数 | 用了 `create_time` 计算 | 改为 `finished_at - started_at` |
| `bill_content` 为空 | 旧代码不保存原始 CSV | 新增 `bill_content` LONGTEXT 列 |
| 下载账单报错 | `ResponseEntity<byte[]>` 被 CommonResult 包装 | 改用 `HttpServletResponse` 直写流 |
| ALL 类型卡死 | `executeReconciliation` 无 ALL 分支 | 分别调用 PAYMENT + PROFIT_SHARING |
