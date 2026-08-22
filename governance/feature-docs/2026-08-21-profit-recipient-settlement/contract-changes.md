# Contract Changes — 分账收款人结算

## API

### 汇总查询

`GET /admin-api/pay/profit-recipient-settlement/summary-page`

权限：`pay:profit-recipient-settlement:query`

请求参数：分页参数、Tab 类型（`SHOP`/`PLATFORM`）、结算日期范围、汇总方式（`DAY`/`WEEK`/`MONTH`）、商圈/店铺/收款人 ID 或名称/平台角色/绑定关系筛选项。

响应至少包含：汇总周期、收款人、角色、历史商圈/店铺、当前关系状态、结算金额、结算手续费、净到账金额、记录数和采集状态。

### 明细查询

`GET /admin-api/pay/profit-recipient-settlement/detail-page`

权限：`pay:profit-recipient-settlement:query`

请求参数：分页参数、Tab 类型、收款人 ID 或名称、结算日期或汇总周期、商圈/店铺/角色/绑定关系筛选项。

响应至少包含：结算日期、结算类型、结算状态、结算金额、手续费、净到账金额、脱敏卡号和失败描述。

### 单日重新拉取

`POST /admin-api/pay/profit-recipient-settlement/recollect`

权限：`pay:profit-recipient-settlement:recollect`

请求只接受一个结算日期。接口返回执行标识，不等待所有外部调用完成。

### 采集任务状态

`GET /admin-api/pay/profit-recipient-settlement/recollect-status`

权限：`pay:profit-recipient-settlement:query`

返回执行状态、目标日期、总收款人数、成功数、失败数、明细数、开始/结束时间和失败摘要。

## DB

### DDL 变更

本需求涉及数据库 DDL，新增以下 4 张表：

1. `yshop_adapay_profit_recipient_settlement_task`：采集任务主表。
2. `yshop_adapay_profit_recipient_settlement_task_recipient`：任务内收款人执行结果和快照表。
3. `yshop_adapay_profit_recipient_binding_history`：店铺与收款人历史绑定表。
4. `yshop_adapay_profit_recipient_settlement_detail`：AdaPay 结算明细事实表。

新增表均包含 `tenant_id`、创建/更新时间和逻辑删除字段，并建立租户、结算日期、收款人、店铺/商圈、活动版本及幂等查询所需索引。

现有表的处理原则：

- `yshop_adapay_profit_recipient`：原则上不修改当前收款人表结构，历史信息写入绑定历史表和结算事实快照。
- `yshop_store_shop`：继续保留当前绑定字段；绑定/解绑逻辑同时写入绑定历史表，不用当前字段反推历史。
- 菜单和权限：属于菜单/权限数据初始化（DML），不是业务表 DDL，但随同迁移脚本提供。

### 数据结构内容

以下字段为本期设计基线，字段名、类型和约束需按此实现；所有表均使用 `utf8mb4`、InnoDB，并包含 `creator`、`create_time`、`updater`、`update_time`、`deleted` 审计字段。

#### 1. 采集任务主表：`yshop_adapay_profit_recipient_settlement_task`

| 字段 | 类型 | 必填/默认 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK，自增 | 任务 ID |
| `tenant_id` | BIGINT | NOT NULL | 租户 ID |
| `settle_date` | DATE | NOT NULL | 目标结算日期，按 AdaPay `settle_date` |
| `attempt_no` | INT | NOT NULL DEFAULT 1 | 同租户同日期的采集次数 |
| `trigger_type` | VARCHAR(16) | NOT NULL DEFAULT `AUTO` | `AUTO` 自动任务、`MANUAL` 手工重拉 |
| `trigger_user_id` | BIGINT | NULL | 手工触发人 ID |
| `execution_status` | VARCHAR(32) | NOT NULL DEFAULT `PENDING` | `PENDING/RUNNING/SUCCEEDED/PARTIAL_FAILED/FAILED` |
| `error_msg` | VARCHAR(2000) | NULL | 任务级错误摘要 |
| `total_recipient_count` | INT | DEFAULT 0 | 收款人总数 |
| `success_recipient_count` | INT | DEFAULT 0 | 成功收款人数 |
| `failed_recipient_count` | INT | DEFAULT 0 | 失败收款人数 |
| `total_detail_count` | INT | DEFAULT 0 | 本次成功采集的明细数 |
| `started_at` | DATETIME | NULL | 开始时间 |
| `finished_at` | DATETIME | NULL | 完成时间 |
| `duration_ms` | BIGINT | NULL | 执行耗时，毫秒 |
| `prev_task_id` | BIGINT | NULL | 上一次同日期任务 ID |
| `creator` / `updater` | VARCHAR(64) | NULL | 创建/更新人，系统任务为 `system` |
| `create_time` / `update_time` | DATETIME | NOT NULL | 创建/更新时间 |
| `deleted` | TINYINT | NOT NULL DEFAULT 0 | 逻辑删除 |

约束和索引：

- 唯一键：`uk_tenant_settle_date_attempt_deleted (tenant_id, settle_date, attempt_no, deleted)`。
- 查询索引：`idx_tenant_settle_date_status (tenant_id, settle_date, execution_status, deleted)`。

#### 2. 任务收款人结果表：`yshop_adapay_profit_recipient_settlement_task_recipient`

该表用于记录“某次任务对某个收款人”的成功/失败结果；没有明细的空列表也必须有一条成功记录。

| 字段 | 类型 | 必填/默认 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK，自增 | 任务收款人记录 ID |
| `tenant_id` | BIGINT | NOT NULL | 租户 ID |
| `task_id` | BIGINT | NOT NULL | 关联采集任务 ID |
| `binding_history_id` | BIGINT | NULL | 本次使用的历史绑定 ID；平台级为空 |
| `recipient_id` | BIGINT | NOT NULL | 分账收款人 ID，保留已逻辑删除记录的 ID |
| `recipient_type` | TINYINT | NOT NULL | `1` 平台级，`2` 店铺级 |
| `role` | TINYINT | NULL | `1` 平台，`2` 配送方，`3` 销售方 |
| `recipient_name` | VARCHAR(64) | NOT NULL | 收款人名称快照 |
| `member_type` | TINYINT | NOT NULL | `1` 个人，`2` 企业 |
| `member_id` | VARCHAR(64) | NOT NULL | AdaPay Member ID 快照 |
| `settle_account_id` | VARCHAR(64) | NOT NULL DEFAULT `''` | AdaPay 结算账户 ID 快照；平台商户自身无账户时保存空字符串 |
| `shop_id` | BIGINT | NULL | 原关联店铺 ID，平台级为空 |
| `shop_name` | VARCHAR(100) | NULL | 原关联店铺名称快照 |
| `business_region_id` | BIGINT | NULL | 原关联商圈 ID |
| `business_region_name` | VARCHAR(100) | NULL | 原关联商圈名称快照 |
| `execution_status` | VARCHAR(32) | NOT NULL DEFAULT `PENDING` | `PENDING/RUNNING/SUCCEEDED/FAILED` |
| `error_code` | VARCHAR(64) | NULL | SDK/AdaPay/数据校验错误码 |
| `error_message` | VARCHAR(1000) | NULL | 收款人级错误信息 |
| `detail_count` | INT | DEFAULT 0 | 本次返回明细数 |
| `is_active_version` | TINYINT | NOT NULL DEFAULT 0 | 是否为该收款人该日期的活动采集版本 |
| `started_at` / `finished_at` | DATETIME | NULL | 收款人调用开始/结束时间 |
| `duration_ms` | BIGINT | NULL | 收款人调用耗时，毫秒 |
| `creator` / `updater` | VARCHAR(64) | NULL | 创建/更新人 |
| `create_time` / `update_time` | DATETIME | NOT NULL | 创建/更新时间 |
| `deleted` | TINYINT | NOT NULL DEFAULT 0 | 逻辑删除 |

约束和索引：

- 唯一键：`uk_task_recipient_account_deleted (task_id, recipient_id, settle_account_id, deleted)`。
- 查询索引：`idx_tenant_recipient_status (tenant_id, recipient_id, execution_status, deleted)`。
- 任务完成后，成功收款人将本行置为活动版本；失败收款人不改变上一成功版本。

#### 3. 收款人绑定历史表：`yshop_adapay_profit_recipient_binding_history`

| 字段 | 类型 | 必填/默认 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK，自增 | 历史绑定 ID |
| `tenant_id` | BIGINT | NOT NULL | 租户 ID |
| `recipient_id` | BIGINT | NOT NULL | 分账收款人 ID |
| `recipient_type` | TINYINT | NOT NULL | `1` 平台级，`2` 店铺级 |
| `role` | TINYINT | NULL | `1` 平台，`2` 配送方，`3` 销售方 |
| `recipient_name` | VARCHAR(64) | NOT NULL | 收款人名称快照 |
| `member_type` | TINYINT | NOT NULL | Member 类型快照 |
| `member_id` | VARCHAR(64) | NOT NULL | AdaPay Member ID 快照 |
| `settle_account_id` | VARCHAR(64) | NOT NULL DEFAULT `''` | 结算账户 ID 快照；平台级无账户时保存空字符串 |
| `shop_id` | BIGINT | NULL | 绑定店铺 ID；平台级为空 |
| `shop_name` | VARCHAR(100) | NULL | 店铺名称快照 |
| `business_region_id` | BIGINT | NULL | 商圈 ID 快照 |
| `business_region_name` | VARCHAR(100) | NULL | 商圈名称快照 |
| `relation_status` | TINYINT | NOT NULL DEFAULT 1 | `1` 当期，`0` 已结束 |
| `valid_from` | DATETIME | NOT NULL | 绑定生效时间 |
| `valid_to` | DATETIME | NULL | 解绑、换绑或禁用时间 |
| `close_reason` | VARCHAR(32) | NULL | `UNBIND/REPLACE/DISABLED` |
| `creator` / `updater` | VARCHAR(64) | NULL | 创建/更新人 |
| `create_time` / `update_time` | DATETIME | NOT NULL | 创建/更新时间 |
| `deleted` | TINYINT | NOT NULL DEFAULT 0 | 逻辑删除；历史关系禁止物理删除 |

约束和索引：

- 唯一键：`uk_recipient_account_valid_from_deleted (tenant_id, recipient_id, member_id, settle_account_id, valid_from, deleted)`。
- 查询索引：`idx_tenant_shop_valid (tenant_id, shop_id, relation_status, valid_from, valid_to, deleted)`。
- 查询索引：`idx_tenant_recipient_valid (tenant_id, recipient_id, valid_from, valid_to, deleted)`。
- 店铺解绑、换绑、收款人禁用时关闭旧记录并设置 `valid_to`，不得覆盖旧字段。

#### 4. 结算明细事实表：`yshop_adapay_profit_recipient_settlement_detail`

| 字段 | 类型 | 必填/默认 | 说明 |
|---|---|---|---|
| `id` | BIGINT | PK，自增 | 结算明细 ID |
| `tenant_id` | BIGINT | NOT NULL | 租户 ID |
| `task_id` | BIGINT | NOT NULL | 采集任务 ID |
| `task_recipient_id` | BIGINT | NOT NULL | 任务收款人结果 ID |
| `binding_history_id` | BIGINT | NULL | 结算日对应的历史绑定 ID |
| `recipient_id` | BIGINT | NOT NULL | 收款人 ID |
| `recipient_type` | TINYINT | NOT NULL | `1` 平台级，`2` 店铺级 |
| `role` | TINYINT | NULL | `1` 平台，`2` 配送方，`3` 销售方 |
| `recipient_name` | VARCHAR(64) | NOT NULL | 收款人名称快照 |
| `member_id` | VARCHAR(64) | NOT NULL | AdaPay Member ID 快照 |
| `settle_account_id` | VARCHAR(64) | NOT NULL DEFAULT `''` | AdaPay 结算账户 ID 快照；平台级无账户时保存空字符串 |
| `shop_id` / `business_region_id` | BIGINT | NULL | 原店铺/商圈 ID 快照 |
| `shop_name` / `business_region_name` | VARCHAR(100) | NULL | 原店铺/商圈名称快照 |
| `external_detail_key` | VARCHAR(128) | NOT NULL | 外部明细稳定去重键；SDK 未提供明细 ID |
| `settle_date` | DATE | NOT NULL | AdaPay 返回的结算日期 |
| `settle_type` | VARCHAR(16) | NULL | `T1/D1/B` 等结算类型 |
| `settle_stat` | VARCHAR(32) | NOT NULL | `succeeded/failed/pending/no-started` |
| `settle_message` | VARCHAR(512) | NULL | AdaPay 失败/状态描述 |
| `card_name` | VARCHAR(128) | NULL | AdaPay 返回的卡户名；页面默认不展示 |
| `card_no` | VARCHAR(64) | NULL | AdaPay 返回的脱敏卡号 |
| `settle_amount` | DECIMAL(12,2) | NOT NULL DEFAULT 0.00 | `settle_amt` 原始结算金额 |
| `settle_fee_amount` | DECIMAL(12,2) | NOT NULL DEFAULT 0.00 | `settle_fee_amt` 手续费 |
| `net_settle_amount` | DECIMAL(12,2) | NOT NULL DEFAULT 0.00 | `settle_amount - settle_fee_amount` |
| `anomaly_flag` | TINYINT | NOT NULL DEFAULT 0 | 是否存在金额/日期/状态异常 |
| `anomaly_message` | VARCHAR(512) | NULL | 异常说明 |
| `is_active_version` | TINYINT | NOT NULL DEFAULT 0 | 是否属于当前生效采集版本；完整成功发布后置为 1 |
| `raw_response_json` | LONGTEXT | NULL | 原始响应 JSON，需按敏感数据策略控制访问 |
| `creator` / `updater` | VARCHAR(64) | NULL | 创建/更新人 |
| `create_time` / `update_time` | DATETIME | NOT NULL | 创建/更新时间 |
| `deleted` | TINYINT | NOT NULL DEFAULT 0 | 逻辑删除 |

约束和索引：

- 唯一键：`uk_task_recipient_external_deleted (task_recipient_id, external_detail_key, deleted)`。
- 查询索引：`idx_tenant_date_active (tenant_id, settle_date, is_active_version, deleted)`。
- 查询索引：`idx_tenant_shop_date_active (tenant_id, shop_id, settle_date, is_active_version, deleted)`。
- 查询索引：`idx_tenant_recipient_date_active (tenant_id, recipient_id, settle_date, is_active_version, deleted)`。
- `external_detail_key` 不包含 `settle_stat` 和 `settle_message`，避免同一笔从处理中变为成功时重复计数；具体指纹生成规则需用真实响应验证。

幂等约束必须能够区分同租户、同收款人、同结算账户、同结算日期及同一外部明细；同一收款人的一次完整成功采集要原子替换该日期的活动版本，不能因部分响应覆盖既有成功数据。新增迁移脚本使用 `sql/upgrade-2026-08-21-profit-recipient-settlement.sql`，同时提供 DDL 回滚和菜单/权限数据回滚语句，不修改基线 SQL。

## 定时任务与异步执行

- 每日任务以 `Asia/Shanghai` 前一自然日为目标日期。
- 每个收款人独立调用 SDK `querySettleDetail`，单个失败不影响同批其他收款人。
- 同一租户、同一日期只能有一个运行中的自动或手工采集任务。
- 手工重新拉取与每日任务共用同一采集逻辑和幂等规则。
- 页面不直接调用 AdaPay；汇总和明细接口只读本地数据。

## 权限与数据范围

- `pay:profit-recipient-settlement:query`：查看汇总、明细和采集状态。
- `pay:profit-recipient-settlement:recollect`：重新拉取指定日期。
- 所有接口显式隔离租户。
- 店铺 Tab 遵循当前用户商圈/店铺数据范围；平台 Tab 遵循租户及平台财务权限。
- 页面只读，不提供金额、绑定关系或结算状态修改。

## 依赖

- 坐标：`com.holuntech:pay-java-adapay`
- 当前版本：`2.14.14-SNAPSHOT`
- 使用接口：`AdapayPayService.querySettleDetail(...)`
- 该 SDK 版本已封装 `SettleAccount.detail`，调用方不再自行签名或拼接外部请求。

## 外部系统

AdaPay 结算明细接口：

- 必填：`app_id`、`member_id`、`begin_date`、`end_date`
- 可选：`settle_account_id`
- 日期格式：`yyyyMMdd`
- 单次跨度：不超过 31 天
- 重要返回字段：`settle_date`、`settle_amt`、`settle_fee_amt`、`settle_stat`、`settle_type`、`settle_message`

外部失败不得导致已成功保存的其他收款人数据回滚；失败信息必须进入采集任务记录。

## N/A

- MQ/Event：N/A，本期使用定时任务和本地采集任务记录。
- 小程序/C 端 API：N/A。
- `governance/CONTRACT` 机器快照：实现后根据最终 OpenAPI 更新。
