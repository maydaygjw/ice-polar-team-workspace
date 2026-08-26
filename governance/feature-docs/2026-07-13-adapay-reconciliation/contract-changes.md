# 契约变更 — Adapay 日终对账

## API

### 查询接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/admin-api/pay/reconciliation/daily/page` | 对账汇总分页查询 | `pay:reconciliation:query` |
| GET | `/admin-api/pay/reconciliation/daily/{id}` | 对账汇总详情 | `pay:reconciliation:query` |
| GET | `/admin-api/pay/reconciliation/daily/{id}/details` | 对账差异明细分页查询 | `pay:reconciliation:query` |
| GET | `/admin-api/pay/reconciliation/daily/{id}/bill` | 下载原始对账单 CSV | `pay:reconciliation:query` |

### 任务接口

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/admin-api/pay/reconciliation/runs` | 提交异步对账任务，返回 runId | `pay:reconciliation:retrigger` |
| GET | `/admin-api/pay/reconciliation/runs/{runId}` | 查询任务状态 | `pay:reconciliation:query` |

### 租户接口 vs 平台接口

- **租户管理员接口**：不接收 `tenantId`，只操作当前租户。`tenantId` 从当前登录上下文注入。
- **平台财务接口**：允许传入 `tenantId` 选择目标租户，使用平台级角色校验（`@PreAuthorize` + 租户白名单）。

### ReqVO / RespVO

```java
// 分页查询请求
ReconciliationDailyPageReqVO {
    LocalDate billDate;           // 账单日期
    Long tenantId;                // 平台财务接口可选，租户接口不传
    String reconciliationType;    // PAYMENT / PROFIT_SHARING
    String executionStatus;       // PENDING / RUNNING / SUCCEEDED / RETRYABLE_FAILED / FAILED
    String reconciliationResult;  // BALANCED / UNBALANCED / INCOMPLETE
}

// 汇总响应
ReconciliationDailyRespVO {
    Long id;
    Long tenantId;
    String tenantName;
    LocalDate billDate;
    String reconciliationType;
    Integer attemptNo;
    String executionStatus;
    String reconciliationResult;
    String errorMsg;

    // 汇总
    Integer billTotalCount;
    BigDecimal billTotalAmount;
    Integer localTotalCount;
    BigDecimal localTotalAmount;
    Integer matchedCount;
    Integer amountDiffCount;
    Integer statusDiffCount;
    Integer billOnlyCount;
    Integer localOnlyCount;
    Integer pendingCount;         // 本地待分账
    Integer processingCount;      // 本地分账中

    // 文件摘要
    String billFileName;
    String billFileSha256;

    // 执行追踪
    String triggerType;           // AUTO / MANUAL
    String triggerUserName;       // 手动触发人名称
    String retriggerReason;
    Long prevAttemptId;
    LocalDateTime startedAt;
    LocalDateTime finishedAt;
    Long durationMs;
    LocalDateTime createTime;
}

// 明细分页请求
ReconciliationDetailPageReqVO {
    Long reconciliationId;
    Integer matchResult;          // 筛选：0/1/2/3/4，不传=全部
    Integer pageNo;
    Integer pageSize;
}

// 差异明细响应
ReconciliationDetailRespVO {
    Long id;
    String orderId;
    String adapayPaymentId;
    String adapayConfirmId;
    String outPayNo;
    BigDecimal billAmount;
    BigDecimal billFee;
    String billStatus;
    Integer billRowIndex;         // 账单原始行号
    BigDecimal localAmount;
    String localStatus;
    Integer matchResult;
    BigDecimal amountDiff;
    String remark;

    // 分账收款人信息（以 MemberId 对账，角色仅供查看）
    String recipientMemberId;
    String recipientName;
    Integer role;                // 单一角色时展示
    String roleDesc;             // 多角色时展示，如“平台、店铺”；仅展示，不参与匹配
}

// 重新对账请求
ReconciliationRetriggerReqVO {
    Long tenantId;                // 平台财务接口必传
    LocalDate billDate;
    String reconciliationType;    // PAYMENT / PROFIT_SHARING / ALL
    String reason;                // 重跑原因（必填）
}

// 重新对账响应
ReconciliationRetriggerRespVO {
    Long runId;                   // 任务ID，用于查询进度
    String executionStatus;       // 当前状态
}
```

### API 行为明确

| 场景 | HTTP 状态 | 行为 |
|------|-----------|------|
| 正常分页查询 | 200 | 返回 `PageResult<ReconciliationDailyRespVO>` |
| 提交重跑 | 202 | 返回 `runId`，异步执行 |
| 同一租户+日期+类型已有运行中任务 | 200 | 返回现有 `runId`（幂等） |
| 重复提交 | 200 | 返回现有记录，不新建 |
| 账单未生成 | 200 | 汇总表 `execution_status=RETRYABLE_FAILED` |
| 当天或未来日期重跑 | 400 | 错误码 `1008009056` |
| 租户无 Adapay 配置 | 400 | 错误码 `1008009057` |
| 无权限操作目标租户 | 403 | 错误码 `1008009058` |

## 数据库

### 新增表

- `yshop_adapay_reconciliation_daily` — 对账汇总表（按 attempt 版本化）
- `yshop_adapay_reconciliation_detail` — 对账明细表

完整 DDL 见 `technical-design.md`。

### 迁移脚本

- `sql/upgrade-2026-07-12-adapay-reconciliation.sql` — 汇总表 + 明细表
- `sql/upgrade-2026-07-12-adapay-reconciliation.sql` — 菜单和权限
- `sql/upgrade-2026-07-12-adapay-reconciliation.sql` — 租户管理员授权
- `sql/upgrade-2026-07-12-adapay-reconciliation.sql` — 原始账单内容列（LONGTEXT）
- `sql/upgrade-2026-07-12-adapay-reconciliation.sql` — 收款人信息列
- `sql/upgrade-2026-08-26-adapay-reconciliation-member-match.sql` — 按 MemberId 对账及多角色展示列

## 枚举

| 枚举 | 值 |
|------|-----|
| `ReconciliationTypeEnum` | `PAYMENT`, `PROFIT_SHARING` |
| `ExecutionStatusEnum` | `PENDING`, `RUNNING`, `SUCCEEDED`, `RETRYABLE_FAILED`, `FAILED` |
| `ReconciliationResultEnum` | `BALANCED`, `UNBALANCED`, `INCOMPLETE` |
| `MatchResultEnum` | `MATCHED(0)`, `AMOUNT_DIFF(1)`, `BILL_ONLY(2)`, `LOCAL_ONLY(3)`, `STATUS_DIFF(4)` |

## ErrorCode

| 错误码 | 说明 |
|--------|------|
| `1008009050` | 对账记录不存在 |
| `1008009051` | 该日期对账记录已存在 |
| `1008009052` | 账单下载失败 |
| `1008009053` | 账单解析失败 |
| `1008009054` | 对账执行失败 |
| `1008009055` | 任务已在运行中 |
| `1008009056` | 不允许对当天或未来日期对账 |
| `1008009057` | 租户未配置 Adapay 支付 |
| `1008009058` | 无权限操作目标租户 |

## MQ

N/A：本功能不涉及消息队列。

## 权限

| 权限标识 | 说明 | 适用角色 |
|----------|------|----------|
| `pay:reconciliation:query` | 查看对账记录和明细 | 超管、财务 |
| `pay:reconciliation:retrigger` | 提交对账任务 | 超管、财务 |

仅检查 permission 不等同于已验证角色。接口实现需同时使用 `@PreAuthorize` + 角色校验。

## 外部依赖

Adapay SDK `downloadBill(Date, BillType)` — 返回 JSON `{"bill_download_url":"...zip","status":"succeeded"}`，需下载 ZIP 后解压 CSV。实现中通过 `HttpURLConnection` + `ZipInputStream` 处理。

## 依赖

本功能在 `yshop-module-pay` 内部闭环，无新增跨模块依赖。
