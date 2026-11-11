# 契约变更 — AdaPay 对账单管理

## API

Base path：`/admin-api/pay/adapay-bill`。

| 方法与路径 | 权限 | 说明 |
|---|---|---|
| `POST /downloads` | `pay:adapay-bill:download` | 创建某日期异步下载任务 |
| `GET /downloads/{id}` | `pay:adapay-bill:query` | 查询任务状态；仅任务创建者可读 |
| `GET /calendar?month=YYYY-MM` | `pay:adapay-bill:query` | 查询当前租户指定月份每日状态 |
| `GET /daily?billDate=YYYY-MM-DD` | `pay:adapay-bill:query` | 查询某日最新成功版本和最近任务状态 |
| `GET /archives?billDate=YYYY-MM-DD` | `pay:adapay-bill:query` | 查询某日全部成功 ZIP 版本，按版本倒序 |
| `GET /charge-details/page` | `pay:adapay-bill:query` | 分页查询 Charge 明细，支持支付ID、商户订单号筛选并返回商家名称 |
| `GET /confirm-details/page` | `pay:adapay-bill:query` | 分页查询 PaymentConfirm 明细，支持商户支付ID筛选并返回商家名称 |
| `GET /div-details/page` | `pay:adapay-bill:query` | 分页查询 Div 明细，支持 `merchantPaymentId`、`memberId` 筛选并返回商家名称 |
| `GET /downloads/{id}/zip` | `pay:adapay-bill:query` | 下载成功任务的 ZIP 附件 |

### 创建下载任务

`POST /downloads` 请求：

```json
{ "billDate": "2026-11-10" }
```

- `billDate` 必填，必须是 `YYYY-MM-DD` 且不晚于昨天。
- 成功响应：`{ "taskId": 123 }`。服务端立即返回，任务异步执行。
- 同一租户同一日期已有活动任务时返回 `1008009077`，不创建第二个任务。
- 租户未配置 AdaPay 支付信息时在异步任务中失败；创建接口仍返回任务 ID，页面通过任务状态查看原因。

任务状态枚举：

| 值 | 说明 |
|---|---|
| `RUNNING` | 任务已创建或正在下载、解析、上传 |
| `SUCCEEDED` | ZIP 已保存，三类明细已原子替换 |
| `FAILED` | 任一步失败；旧明细保持不变 |

`GET /downloads/{id}` 响应：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `long` | 任务 ID |
| `billDate` | `date` | 账单日期 |
| `versionNo` | `int` | 本次下载序号；成功记录作为 ZIP 版本号 |
| `status` | `enum` | `RUNNING` / `SUCCEEDED` / `FAILED` |
| `errorCode` | `string \| null` | 失败错误码 |
| `errorSummary` | `string \| null` | 失败原因，最长 2000 字符 |
| `startedAt` | `datetime \| null` | 开始执行时间 |
| `finishedAt` | `datetime \| null` | 结束时间 |

该接口只返回当前租户内由当前登录用户创建的任务；任务 ID 不存在或属于其他用户返回 `1008009078`。

### 日历与日状态

`GET /calendar` 响应：

```json
{
  "month": "2026-11",
  "days": [
    {
      "date": "2026-11-10",
      "status": "SUCCEEDED",
      "runningCount": 0,
      "successCount": 2,
      "failedCount": 1,
      "latestArchiveId": 102
    }
  ]
}
```

`status` 取值为 `NONE`、`RUNNING`、`SUCCEEDED`、`FAILED`，优先级为 `RUNNING` > `SUCCEEDED` > `FAILED` > `NONE`。响应覆盖指定月份每一天。

`GET /daily` 响应包含 `billDate`、`status`、最新成功版本 `latestArchive`、最近任务 `latestTask` 和 `successCount`。`latestArchive` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `long` | 成功任务 ID，也是 ZIP 版本 ID |
| `versionNo` | `int` | ZIP 版本号 |
| `zipFileName` | `string` | 原始 ZIP 文件名 |
| `zipFileSize` | `long` | ZIP 字节数 |
| `zipFileSha256` | `string` | ZIP SHA-256 |
| `chargeRowCount` | `int` | Charge 数据行数 |
| `confirmRowCount` | `int` | Confirm 数据行数 |
| `divRowCount` | `int` | Div 数据行数 |
| `startedAt` / `finishedAt` | `datetime` | 下载开始和完成时间 |

接口不返回 OSS 内部 URL；ZIP 统一通过下载端点回读。

`GET /archives` 返回同日成功版本数组，字段同 `latestArchive`，按 `versionNo` 倒序。

### 明细分页

明细接口统一使用：

- `billDate`：必填，`YYYY-MM-DD`。
- `pageNo`、`pageSize`：标准分页参数，服务端按数据库分页。
- 仅查询该日期最新成功版本对应的明细；无成功版本时返回空分页。查询结果增加可空 `shopId`、`shopName`，为导入时按 Charge 支付ID匹配订单 `transactionId` 冗余的门快照；Confirm、Div 经商户支付ID关联同版本 Charge 继承。关联仅补充展示信息，分页查询不实时联表。

筛选参数：Charge 接受 `paymentId`、`merchantOrderNo`；Confirm 接受 `merchantPaymentId`；Div 接受 `merchantPaymentId`、`memberId`。均为可选精确匹配。

Charge 响应行：

| 字段 | CSV 表头 |
|---|---|
| `rowNo` | 原始物理行号 |
| `tradeTime` | 交易时间 |
| `appId` | `app_id` |
| `paymentId` | 支付ID |
| `merchantOrderNo` | 商户订单号 |
| `tradeType` | 交易类型 |
| `tradeAmount` | 交易金额 |
| `feeAmount` | 手续费金额 |
| `currency` | 货币种类 |
| `tradeStatus` | 交易状态 |
| `thirdPartyOrderNo` | 第三方订单号 |
| `payFinishTime` | 支付完成时间 |
| `payMode` | 支付模式 |
| `goodsDescription` | 商品描述 |
| `huabeiPeriods` | 花呗分期期数 |
| `creditedTime` | 入账时间 |
| `frozenStatus` | 冻结状态 |
| `orderDescription` | 订单描述 |
| `channelOrderNo` | 微信/支付宝订单号 |

Confirm 响应行：

| 字段 | CSV 表头 |
|---|---|
| `rowNo` | 原始物理行号 |
| `tradeTime` | 交易时间 |
| `appId` | `app_id` |
| `confirmId` | 确认ID |
| `confirmOrderNo` | 支付确认订单号 |
| `paymentId` | 商户支付ID |
| `confirmAmount` | 确认金额 |
| `feeAmount` | 手续费金额 |
| `confirmStatus` | 确认状态 |

Div 响应行：

| 字段 | CSV 表头 |
|---|---|
| `rowNo` | 原始物理行号 |
| `paymentId` | 支付对象id |
| `orderNo` | 订单号 |
| `tradeAmount` | 交易金额 |
| `divAmount` | 分账金额 |
| `tradeFinishTime` | 交易完成时间 |
| `payMode` | 支付模式 |
| `confirmId` | 支付确认对象id |
| `memberId` | 分账用户 |
| `feeBearer` | 手续费承担方 |
| `feeAmount` | 手续费金额 |
| `originOrderNo` | 原订单号 |

三类响应都包含 `downloadId` 和 `extraFields`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `downloadId` | `long` | 明细所属成功 ZIP 版本任务 ID |
| `rawLine` | `string` | CSV 原始数据行，保留原始字段顺序和文本 |
| `extraFields` | `array<{name,value}>` | 已知表头之外的尾部字段，按 CSV 原顺序返回 |

`memberId` 只作用于 Div 明细的“分账用户”字段，等值匹配，最大长度 128；不修改 Charge 和 Confirm。空字符串视为未传筛选条件。

### ZIP 下载

`GET /downloads/{id}/zip`：

- 只能下载当前租户、状态为 `SUCCEEDED` 的任务；否则返回 `1008009079`。
- 响应为 `application/zip` 字节流，文件名 `bill_{billDate}_v{versionNo}.zip`。
- 服务端通过 `FileApi.getFileContentByUrl` 从主 OSS 回读，不把 OSS 地址直接返回给浏览器。

### 错误语义

| 错误码 | 触发场景 |
|---|---|
| `1008009075` | 日期为空、格式非法或晚于昨天 |
| `1008009076` | 当前租户未配置 AdaPay 支付信息 |
| `1008009077` | 同一租户、同一日期已有下载任务执行 |
| `1008009078` | 任务不存在或不属于当前创建者 |
| `1008009079` | ZIP 版本不存在、跨租户或不是成功状态 |
| `1008009080` | AdaPay ZIP 下载失败 |
| `1008009081` | ZIP 不完整或目标 CSV 缺失 |
| `1008009082` | CSV 表头或数据行结构非法 |
| `1008009083` | ZIP 归档或解析明细写入失败 |

异步任务失败将错误码和摘要写入下载记录；参数校验错误仍按统一参数错误返回。

## DB

新增迁移：`backend/sql/migrations/V2026111102__adapay_bill_management.sql`。

### `yshop_adapay_bill_download`

| 字段 | 类型 | 约束/说明 |
|---|---|---|
| `id` | `BIGINT` | 主键，自增 |
| `tenant_id` | `BIGINT` | 非空 |
| `active_key` | `VARCHAR(64)` | 可空；活动任务为 `{tenantId}:{billDate}`，唯一 |
| `creator_id` | `BIGINT` | 非空，任务创建者 |
| `bill_date` | `DATE` | 非空 |
| `attempt_no` | `INT` | 非空，租户内日期维度递增 |
| `status` | `VARCHAR(16)` | 非空，`RUNNING` / `SUCCEEDED` / `FAILED` |
| `zip_file_name` | `VARCHAR(128)` | 可空 |
| `zip_file_url` | `VARCHAR(1024)` | 可空；失败但已上传时保留供追踪 |
| `zip_file_sha256` | `CHAR(64)` | 可空 |
| `zip_file_size` | `BIGINT` | 可空 |
| `charge_row_count` | `INT` | 非空，默认 0 |
| `confirm_row_count` | `INT` | 非空，默认 0 |
| `div_row_count` | `INT` | 非空，默认 0 |
| `error_code` | `VARCHAR(32)` | 可空 |
| `error_summary` | `VARCHAR(2000)` | 可空 |
| `started_at` | `DATETIME` | 可空 |
| `finished_at` | `DATETIME` | 可空 |
| 标准审计字段 | — | `creator`、`create_time`、`updater`、`update_time`、`deleted` |

约束和索引：

- `PRIMARY KEY (id)`
- `UNIQUE KEY uk_adapay_bill_download_attempt (tenant_id, bill_date, attempt_no)`
- `UNIQUE KEY uk_adapay_bill_download_active (active_key)`
- `KEY idx_adapay_bill_download_date (tenant_id, bill_date, status, id)`

### 三张原始明细表

明细表共同结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `BIGINT` | 主键，自增 |
| `tenant_id` | `BIGINT` | 非空 |
| `download_id` | `BIGINT` | 非空，关联成功下载记录 |
| `bill_date` | `DATE` | 非空，便于按日替换和查询 |
| `row_no` | `INT` | 非空，CSV 原始物理行号 |
| `raw_line` | `TEXT` | 原始数据行 |
| `extra_fields` | `JSON` | 已知字段外的有序扩展字段 |
| `creator` / `create_time` / `updater` / `update_time` | 标准审计 | 不使用逻辑删除 |

表名和固定字段：

- `yshop_adapay_bill_charge_detail`：保存 Charge 18 个固定字段，字段名与响应 `camelCase` 对应。
- `yshop_adapay_bill_confirm_detail`：保存 Confirm 8 个固定字段。
- `yshop_adapay_bill_div_detail`：保存 Div 11 个固定字段，其中 `member_id VARCHAR(128)` 对应“分账用户”。

所有固定字段使用 `VARCHAR(512)`；`goodsDescription` 和 `orderDescription` 使用 `VARCHAR(2048)`。金额、日期和状态仍保存原始字符串。

索引：

- 三张表均使用 `UNIQUE KEY uk_adapay_bill_detail_row (tenant_id, bill_date, row_no)`。
- 三张表均使用 `KEY idx_adapay_bill_detail_download (tenant_id, download_id)`。
- 三张表均使用 `KEY idx_adapay_bill_detail_page (tenant_id, bill_date, id)`。
- Div 额外使用 `KEY idx_adapay_bill_div_member (tenant_id, bill_date, member_id, id)`。

成功重拉在同一事务内按 `tenant_id + bill_date` 物理删除旧明细并插入新明细；解析明细不提供历史版本查询。

### 迁移与回滚

- 迁移创建四张新表和菜单权限，不修改现有对账、订单、支付或分账表。
- 菜单：页面“对账单管理”挂在现有“日终对账记录”同级，路由 `/mall/store/adapayBill/index`，组件名 `AdapayBillManagement`；按钮权限为 `pay:adapay-bill:query`、`pay:adapay-bill:download`。
- 迁移为所有 `tenant_admin` 角色补充两个权限，并同步补入正在使用的租户套餐；超级管理员沿用全量菜单。
- 回滚按依赖逆序删除角色菜单、套餐菜单引用和 `system_menu` 记录，然后删除四张新表。

## 权限与数据范围

| 权限 | 语义 |
|---|---|
| `pay:adapay-bill:query` | 查看日历、日详情、三类明细和下载成功 ZIP |
| `pay:adapay-bill:download` | 发起新日期下载或对已有日期重新拉取 |

所有接口仅允许当前租户数据。创建任务不接受租户 ID；后台任务显式使用创建时租户上下文。任务状态只允许创建者读取，日历和 ZIP 版本数据允许当前租户内有查询权限的管理员读取。本功能没有部门或店铺级数据范围。

## 依赖与外部系统

- `yshop-module-pay-biz` 新增 `yshop-module-infra-api` 依赖，用于 `FileApi` 保存和读取 ZIP。
- 复用当前 `holuntech pay-java-adapay 2.14.14-SNAPSHOT` SDK 和 `AdapayBillType.STANDARD`；请求 `/v1/bill/download`，标准账单只传 `bill_date=yyyyMMdd`。
- 使用项目已有 Hutool CSV 读取能力、Redisson、Spring `@Async` 和 `TenantUtils`；不新增 MQ、定时任务或第三方库。
- AdaPay 调用失败不重试；用户可以再次手动发起。外部请求和响应只记录 DEBUG 级诊断，不记录支付密钥、完整商户配置或账单敏感内容。

## MQ

N/A：本功能不新增消息生产或消费。
