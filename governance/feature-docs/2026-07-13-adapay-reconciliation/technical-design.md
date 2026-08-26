# 技术设计 — Adapay 日终对账

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-pay-biz` | 新增+修改 | 对账 Job/Service/DO/Mapper/Controller + 3 次 SQL 迁移 |
| `yshop-module-pay-api` | 修改 | 新增对账枚举、ErrorCode 常量 |
| `admin/` | 修改 | 日终对账记录页面（单页，内联明细） |

## 关键实现决策（开发中验证）

### 1. Adapay downloadBill 返回 ZIP 下载 URL

**已验证**：`downloadBill()` 返回 JSON `{"bill_download_url":"...zip","status":"succeeded"}`，不是 CSV 内容。

实现：`resolveBillContent()` 检测 `bill_download_url` 字段 → `HttpURLConnection` 下载 ZIP → `ZipInputStream` 解压，按文件名前缀匹配 CSV 文件（`Charge_`/`PaymentConfirm_`/`Div_`）。原始 CSV 内容存入 `bill_content` LONGTEXT 列供管理后台下载。

### 2. 按租户 app_id 过滤账单

Adapay 日终账单包含所有商户的交易。实现中使用 `getTenantAppId()` 从 `merchant_details` 获取当前租户的 `appid`，对 Charge/PaymentConfirm CSV 按 `app_id` 列过滤。Div CSV 无 `app_id` 列，通过已匹配的 `payment_id` 集合间接过滤。

### 3. 分账收款人区分：MemberId 为主，fee_bearer 仅展示角色

Div CSV 中 `div_user` 是 Adapay 实际的 MemberId（如 `m_154_2_91320507MACNTT2938_0`）。分账金额按 `payment_id + confirm_id + div_user` 对账，`fee_bearer` 只用于推导平台/店铺等展示角色，不参与匹配。

### 4. 分账对账三阶段明细

`matchProfitSharings` 产出三种明细，全部写入同一张 detail 表：

- **Phase 1 - 确认汇总**：PaymentConfirm 行 vs 本地 `pay_price`，比较确认金额
- **Phase 2 - 收款人对账**：按 `payment_id + confirm_id + MemberId` 汇总 Div 与本地分账明细金额；同一 MemberId 跨多个角色时合并为一条，同时保留角色供查看
- **Phase 3 - 本地独有**：本地有分账记录但账单无对应 Confirm

### 5. 收款人信息字段

明细表新增 4 列：`recipient_member_id`、`recipient_name`、`role`、`role_desc`（SQL: `upgrade-2026-07-12-adapay-reconciliation.sql` 和 `upgrade-2026-08-26-adapay-reconciliation-member-match.sql`）。`recipient_member_id` 是分账金额匹配字段；`role`/`role_desc` 仅供查看。

### 6. 账单下载接口

使用 `HttpServletResponse` 直接写字节流（绕过 `CommonResult` 包装），Content-Type `text/csv; charset=UTF-8`。

### 7. ALL 类型处理

手动对账选择"全部"时，`executeReconciliation` 分别调用 PAYMENT 和 PROFIT_SHARING 子类型，各创建独立的 attempt 记录。

## 对账口径

基于真实账单分析（`sample-bills/`），Adapay 每日生成 5 个 CSV 文件。本期实现两个独立对账口径：

### 口径一：支付交易对账

```
外部数据源：Charge_20260711.csv（支付流水记录）
  └── 字段：交易时间, app_id, 支付ID, 商户订单号, 交易类型, 交易金额, 手续费金额,
            货币种类, 交易状态, 第三方订单号, 支付完成时间, 支付模式, ...
  
本地数据源：pay_out_order_no (status=1) + yshop_store_order (paid=1)
  └── 关联 Key：adapay_payment_id

比较维度：支付金额、支付状态(S/F)、支付时间
排除规则：交易状态=F（支付失败）不参与比较
```

### 口径二：分账确认对账

```
外部数据源 A：PaymentConfirm_20260711.csv（支付确认流水）
  └── 字段：交易时间, app_id, 确认ID, 支付确认订单号, 商户支付ID, 确认金额, 手续费金额, 确认状态

外部数据源 B：Div_20260711.csv（分账流水记录）
  └── 字段：支付对象id, 订单号, 交易金额, 分账金额, 交易完成时间, 支付模式,
            支付确认对象id, 分账用户, 手续费承担方, 手续费金额, 原订单号
  └── 结构：每笔分账订单 2+ 行（平台 Y + 各店铺 N）

本地数据源：yshop_adapay_profit_sharing_order (sharing_status=SUCCESS)
           + yshop_adapay_profit_sharing_order_item
  └── 关联 Key：adapay_confirm_id（PaymentConfirm）、adapay_payment_id（Div）

比较维度：
  ① PaymentConfirm.确认金额 vs profit_sharing_order.pay_price
  ② sum(Div.分账金额 WHERE 支付对象id=X) vs sum(item.amount)
  ③ 确认状态 vs sharing_status
```

## 架构决策

1. **支付对账和分账对账独立执行**：两个口径各自下载账单、各自查询本地数据、各自产出汇总+明细，标记 `reconciliation_type` 区分。

2. **基于真实账单格式解析**：账单格式已由真实文件确认（`sample-bills/` 目录），CSV 格式，`#` 开头行为注释，末尾 `#合计` 行。解析时不依赖假设字段。

3. **金额精确到分**：所有金额统一 `×100` 转为 `long`（整数分），精确比较，任意一分钱差异均记录为 `AMOUNT_DIFF`。手续费原始值保留但不参与金额匹配。

4. **分账对账日期使用 `sharing_time`**：本地筛选以 `profit_sharing_order.sharing_time`（实际分账成功时间）为准，非 `create_time`。支付对账以支付成功时间为准。时区统一 `Asia/Shanghai`。

5. **版本化重跑（attempt）**：每次对账执行新增一个 attempt（`attempt_no` 自增），不删除历史记录。汇总页默认展示最新成功 attempt。保存原始账单 SHA-256 摘要、触发方式、触发人。

6. **执行状态与对账结果分离**：

```
execution_status（任务执行状态）:
  PENDING → RUNNING → SUCCEEDED
                     → RETRYABLE_FAILED（账单未生成）
                     → FAILED（系统错误）

reconciliation_result（对账结果，仅 SUCCEEDED 时有意义）:
  BALANCED / UNBALANCED / INCOMPLETE
```

7. **并发控制**：使用数据库条件更新或 Redisson 分布式锁，同一 `(tenant_id, bill_date, reconciliation_type)` 同时只允许一个运行中任务。

8. **Adapay SDK 调用**：`downloadBill` 方法的实际参数（`BillType` 枚举值）待技术验证确认。当前已知 SDK 中有 `downloadAdapayBill(Map)` 和 `downloadBill(Date, BillType)` 两个签名，需在实际开发时确定正确调用方式。本设计使用 `downloadBill(Date, BillType)` 作为默认路径，阻塞状态 `blocked=true` 直到技术验证完成。

9. **异步手动重跑**：管理后台提交重跑请求后立即返回 `runId`，后端异步执行。前端通过轮询任务状态获取结果。

10. **BillType 参考值**：基于 SDK 分析，可能的账单类型参数包括 `trade`（支付）、`settle`（结算）等，具体值待技术验证。若 SDK 的 `downloadBill` 不支持按类型筛选，则下载全部账单后本地按文件类型分拆。

## 流程设计

### 对账主流程

```
02:00 — AdapayReconciliationJob.execute()
  ├─ ① 遍历所有已配置 Adapay 的租户
  │   └─ merchant_details 中 details_id = 'adapay_h5{tenantId}' 的记录
  │
  ├─ ② 对每个租户，依次执行两个口径：
  │
  │   ┌── 口径一：支付交易对账 ──┐
  │   │  ├─ 检查 attempt 幂等
  │   │  ├─ downloadBill(yesterday, CHARGE) → Charge CSV
  │   │  ├─ 解析 → List<BillPaymentRecord>
  │   │  ├─ 查询本地支付记录
  │   │  ├─ 执行逐笔匹配
  │   │  ├─ 写入汇总 + 明细（type=PAYMENT, attempt_no=N）
  │   │  └─ 更新 execution_status + reconciliation_result
  │   └──────────────────────────┘
  │
  │   ┌── 口径二：分账确认对账 ──┐
  │   │  ├─ downloadBill(yesterday, CONFIRM) → PaymentConfirm CSV
  │   │  ├─ downloadBill(yesterday, DIV) → Div CSV
  │   │  ├─ 解析 → List<BillConfirmRecord>, List<BillDivRecord>
  │   │  ├─ 查询本地分账记录 (sharing_time 在目标日期)
  │   │  ├─ 按 confirm_id 匹配 PaymentConfirm
  │   │  ├─ 按 payment_id+confirm_id 汇总 Div 后匹配
  │   │  ├─ 写入汇总 + 明细（type=PROFIT_SHARING, attempt_no=M）
  │   │  └─ 更新 execution_status + reconciliation_result
  │   └──────────────────────────┘
  │
  └─ ③ 汇总所有租户结果，输出对账完成日志
```

### 匹配算法

```java
// 支付交易对账
Map<String, BillPaymentRecord> billMap = billRecords.stream()
    .filter(r -> "S".equals(r.status()))  // 仅成功交易
    .collect(toMap(BillPaymentRecord::paymentId, identity()));

Map<String, LocalPaymentRecord> localMap = localPayments.stream()
    .collect(toMap(LocalPaymentRecord::adapayPaymentId, identity()));

// 双向匹配
for (BillPaymentRecord bill : billMap.values()) {
    LocalPaymentRecord local = localMap.get(bill.paymentId());
    if (local == null) {
        detail.setMatchResult(BILL_ONLY);
    } else {
        long billAmount = toCents(bill.amount());
        long localAmount = toCents(local.payPrice());
        if (billAmount != localAmount) {
            detail.setMatchResult(AMOUNT_DIFF);
            detail.setAmountDiff(billAmount - localAmount);
        } else if (!bill.status().equals(mapLocalStatus(local.status()))) {
            detail.setMatchResult(STATUS_DIFF);
        } else {
            detail.setMatchResult(MATCHED);
        }
    }
}
for (LocalPaymentRecord local : localMap.values()) {
    if (!billMap.containsKey(local.adapayPaymentId())) {
        detail.setMatchResult(LOCAL_ONLY);
    }
}
```

### 本地数据查询

**支付对账**：
```sql
SELECT pno.adapay_payment_id, pno.out_pay_no, pno.order_id,
       o.pay_price, o.status, o.pay_time
FROM pay_out_order_no pno
JOIN yshop_store_order o ON o.order_id = pno.order_id
WHERE pno.tenant_id = #{tenantId}
  AND pno.pay_type = 'adapay'
  AND pno.status = 1
  AND o.paid = 1
  AND o.pay_time >= #{yesterdayStart}
  AND o.pay_time < #{todayStart}
```

**分账对账**：
```sql
SELECT pso.adapay_payment_id, pso.adapay_confirm_id,
       pso.pay_price, pso.sharing_status, pso.sharing_time,
       pso.fee_bearer_role
FROM yshop_adapay_profit_sharing_order pso
WHERE pso.tenant_id = #{tenantId}
  AND pso.sharing_status = 2  -- SUCCESS
  AND pso.sharing_time >= #{yesterdayStart}
  AND pso.sharing_time < #{todayStart}
```

## 数据模型

### `yshop_adapay_reconciliation_daily`（对账汇总表）

```sql
CREATE TABLE yshop_adapay_reconciliation_daily (
    id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id             BIGINT NOT NULL COMMENT '租户ID',
    bill_date             DATE NOT NULL COMMENT '账单日期',
    reconciliation_type   VARCHAR(32) NOT NULL COMMENT 'PAYMENT / PROFIT_SHARING',
    attempt_no            INT NOT NULL DEFAULT 1 COMMENT '第几次执行',

    -- 执行状态与对账结果分离
    execution_status      VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/SUCCEEDED/RETRYABLE_FAILED/FAILED',
    reconciliation_result VARCHAR(32) COMMENT 'BALANCED/UNBALANCED/INCOMPLETE (仅SUCCEEDED时)',
    error_msg             VARCHAR(2000) COMMENT '失败原因',

    -- 汇总统计
    bill_total_count      INT DEFAULT 0 COMMENT '账单总笔数',
    bill_total_amount     DECIMAL(12,2) DEFAULT 0.00 COMMENT '账单总金额（单位元）',
    local_total_count     INT DEFAULT 0 COMMENT '本地总笔数',
    local_total_amount    DECIMAL(12,2) DEFAULT 0.00 COMMENT '本地总金额',

    matched_count         INT DEFAULT 0 COMMENT '对平笔数',
    amount_diff_count     INT DEFAULT 0 COMMENT '金额差异笔数',
    status_diff_count     INT DEFAULT 0 COMMENT '状态不一致笔数',
    bill_only_count       INT DEFAULT 0 COMMENT '仅账单有',
    local_only_count      INT DEFAULT 0 COMMENT '仅本地有',
    pending_count         INT DEFAULT 0 COMMENT '本地待分账笔数',
    processing_count      INT DEFAULT 0 COMMENT '本地分账中笔数',

    -- 账单文件摘要
    bill_file_name        VARCHAR(255) COMMENT '原始账单文件名',
    bill_file_sha256      VARCHAR(64) COMMENT '原始账单 SHA-256',
    bill_download_time    DATETIME COMMENT '账单下载时间',

    -- 执行追踪
    started_at            DATETIME COMMENT '开始执行时间',
    finished_at           DATETIME COMMENT '完成执行时间',
    duration_ms           BIGINT COMMENT '执行耗时(ms)',
    trigger_type          VARCHAR(16) NOT NULL DEFAULT 'AUTO' COMMENT 'AUTO / MANUAL',
    trigger_user_id       BIGINT COMMENT '手动触发人',
    retrigger_reason      VARCHAR(500) COMMENT '重跑原因',

    -- 链接上一次 attempt
    prev_attempt_id       BIGINT COMMENT '前一次attempt ID',

    creator               VARCHAR(64) DEFAULT 'system',
    create_time           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updater               VARCHAR(64) DEFAULT 'system',
    update_time           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted               TINYINT DEFAULT 0,

    UNIQUE KEY uk_tenant_date_type_attempt (tenant_id, bill_date, reconciliation_type, attempt_no),
    KEY idx_tenant_date_type (tenant_id, bill_date, reconciliation_type)
);
```

### `yshop_adapay_reconciliation_detail`（对账明细表）

```sql
CREATE TABLE yshop_adapay_reconciliation_detail (
    id                    BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id             BIGINT NOT NULL,
    reconciliation_id     BIGINT NOT NULL COMMENT '关联对账汇总表ID',

    order_id              VARCHAR(32) COMMENT '本地订单号',
    adapay_payment_id     VARCHAR(64) COMMENT 'Adapay支付ID',
    adapay_confirm_id     VARCHAR(64) COMMENT 'Adapay支付确认ID',
    out_pay_no            VARCHAR(128) COMMENT '外部支付单号',

    -- 账单侧
    bill_amount           DECIMAL(12,2) COMMENT '账单金额',
    bill_fee              DECIMAL(12,2) COMMENT '账单手续费',
    bill_status           VARCHAR(32) COMMENT '账单交易状态',
    bill_row_index        INT COMMENT '账单原始行号',

    -- 本地侧
    local_amount          DECIMAL(12,2) COMMENT '本地金额',
    local_status          VARCHAR(32) COMMENT '本地状态',

    -- 结果
    match_result          TINYINT COMMENT '0=对平 1=金额差异 2=仅账单有 3=仅本地有 4=状态不一致',
    amount_diff           DECIMAL(12,2) COMMENT '金额差异(bill-local)，单位元',
    remark                VARCHAR(500),
    recipient_member_id   VARCHAR(64) COMMENT '收款人MemberId，对账主维度',
    recipient_name        VARCHAR(64) COMMENT '收款人名称',
    role                  INT COMMENT '分账角色，仅供展示',
    role_desc             VARCHAR(128) COMMENT '多角色展示文本，仅供展示',

    creator               VARCHAR(64) DEFAULT 'system',
    create_time           DATETIME DEFAULT CURRENT_TIMESTAMP,
    updater               VARCHAR(64) DEFAULT 'system',
    update_time           DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted               TINYINT DEFAULT 0,

    KEY idx_reconciliation (reconciliation_id),
    KEY idx_tenant_recon_match (tenant_id, reconciliation_id, match_result),
    KEY idx_order (order_id)
);
```

### 枚举

```java
// 对账类型
public enum ReconciliationTypeEnum {
    PAYMENT("PAYMENT", "支付交易对账"),
    PROFIT_SHARING("PROFIT_SHARING", "分账确认对账");
}

// 任务执行状态
public enum ExecutionStatusEnum {
    PENDING("PENDING", "待处理"),
    RUNNING("RUNNING", "处理中"),
    SUCCEEDED("SUCCEEDED", "执行成功"),
    RETRYABLE_FAILED("RETRYABLE_FAILED", "可重试失败"),
    FAILED("FAILED", "失败");
}

// 对账结果
public enum ReconciliationResultEnum {
    BALANCED("BALANCED", "对平"),
    UNBALANCED("UNBALANCED", "存在差异"),
    INCOMPLETE("INCOMPLETE", "未完成（仍有待分账记录）");
}

// 匹配结果
public enum MatchResultEnum implements IntArrayValuable {
    MATCHED(0, "对平"),
    AMOUNT_DIFF(1, "金额差异"),
    BILL_ONLY(2, "仅账单有"),
    LOCAL_ONLY(3, "仅本地有"),
    STATUS_DIFF(4, "状态不一致");
}
```

## 并发控制

```java
// 使用 Redisson 分布式锁
String lockKey = "reconciliation:" + tenantId + ":" + billDate + ":" + type;
RLock lock = redissonClient.getLock(lockKey);
if (!lock.tryLock(0, 30, TimeUnit.MINUTES)) {
    log.warn("对账任务已在执行中，跳过: {}", lockKey);
    return;
}
try {
    // execute reconciliation
} finally {
    lock.unlock();
}
```

## Adapay SDK 集成点

### 已验证信息

`downloadBill(Date, BillType)` 返回 JSON：
```json
{"prod_mode":"true","bill_download_url":"https://file.cloudpnr.com/...zip?...","status":"succeeded"}
```

ZIP 文件包含 5 个 CSV：`Charge_`、`Div_`、`Refund_`、`PaymentConfirm_`、`RefundDiv_`。

BillType 枚举值使用 `getCustom()` 返回值 `bill_trade`/`bill_settle`/`bill_profit_sharing` 作为 `adapay_func_code`。

### SDK 调用

```java
// 下载支付账单 → resolveBillContent 自动处理 ZIP URL
Map<String, Object> billResult = adapayService.downloadBill(date, AdapayBillType.TRADE);
String csv = resolveBillContent(billResult, "Charge_");

// 下载分账确认账单
Map<String, Object> confirmResult = adapayService.downloadBill(date, AdapayBillType.SETTLE);
String csv = resolveBillContent(confirmResult, "PaymentConfirm_");

// 下载分账流水账单
Map<String, Object> divResult = adapayService.downloadBill(date, AdapayBillType.PROFIT_SHARING);
String csv = resolveBillContent(divResult, "Div_");
```

## 文件清单

```
backend/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/
├── job/
│   └── AdapayReconciliationJob.java              # 新增
├── service/reconciliation/
│   ├── AdapayReconciliationService.java           # 新增
│   └── AdapayReconciliationServiceImpl.java       # 新增
├── dal/dataobject/reconciliation/
│   ├── AdapayReconciliationDailyDO.java           # 新增
│   └── AdapayReconciliationDetailDO.java          # 新增
├── dal/mysql/reconciliation/
│   ├── AdapayReconciliationDailyMapper.java       # 新增
│   └── AdapayReconciliationDetailMapper.java      # 新增
├── controller/admin/reconciliation/
│   └── AdapayReconciliationController.java        # 新增
└── controller/admin/reconciliation/vo/
    ├── ReconciliationDailyPageReqVO.java          # 新增
    ├── ReconciliationDailyRespVO.java             # 新增
    ├── ReconciliationDetailPageReqVO.java         # 新增
    ├── ReconciliationDetailRespVO.java            # 新增
    └── ReconciliationRetriggerReqVO.java           # 新增

backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/
└── enums/reconciliation/
    ├── ReconciliationTypeEnum.java                 # 新增
    ├── MatchResultEnum.java                        # 新增
    ├── ExecutionStatusEnum.java                    # 新增
    └── ReconciliationResultEnum.java               # 新增

backend/sql/
└── upgrade-2026-07-12-adapay-reconciliation.sql              # 新增

admin/src/
├── views/mall/store/reconciliation/index.vue          # 单页面组件
└── api/pay/reconciliation/index.ts                    # API 定义和类型
```

## 风险评估（已解决）

| 风险 | 等级 | 结果 |
|------|------|------|
| SDK `downloadBill` 返回结构未验证 | ~~高~~ | ✅ 已确认：返回 ZIP URL JSON |
| 账单多租户混合 | ~~中~~ | ✅ 按 `app_id` 过滤 |
| Div 角色匹配字段不确定 | ~~中~~ | ✅ 用 `fee_bearer=Y/N` 区分平台/店铺 |
| 并发重跑与自动任务冲突 | 低 | Redisson 分布式锁 |
