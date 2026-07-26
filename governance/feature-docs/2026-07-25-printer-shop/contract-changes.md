# printer-shop 契约变化

只列变化项。链科字段详见 `governance/KNOWLEDGE/lianke-cloud-print-api.md`。

## 1. 外部系统：链科云打印 v3

- Base URL：`https://cloud.liankenet.com/api`；认证头 `ApiKey`（仅服务端配置，禁止入库/提交）。
- 设备凭证：`deviceId`+`deviceKey` 每次请求携带。
- 用到接口：`GET /device/device_info`、`GET /external_api/printer_list`、`GET /print/printer_params`、`GET /device/printer_status`、`POST /print/job`、`GET /print/job`、`DELETE /print/job`。
- 提交任务关键字段：`devicePort`、`printerModel`(=printer_list 的 `driver_name`)、`dmPaperSize`(9=A4)、`dmCopies`、`jobFile`(URL)、`urlFileExt`、`callbackUrl`。
- SLA/失败策略：提交/查询设超时；状态以回调为准，超时未回调用 `GET /print/job` 主动补偿。
- 回调：POST JSON 到 `callbackUrl`，无签名；字段 `device_id/task_id/task_state/create_time/finish_time/task_result{code,msg}`。task_state：READY/PARSING/SENDING/SUCCESS/FAILURE/SET_REVOKE/REVOKED。

## 2. API

### 入向（链科 → 后端）
- `POST /app-api/device/printer/callback`
  - 入参（JSON body）：`device_id, task_id, task_state, create_time, finish_time, task_result{code,msg}`
  - 校验：device_id 归属本地 printer 设备 + task_id 匹配未终态任务 + 状态只前进（无路径 token，用户已确认）。
  - 幂等：task_id 去重；重复/乱序/回退回调返回成功但不转移。
  - 响应：通用 `{code,msg}`，始终 200（避免链科重投风暴），非法请求记日志。
  - yaml 白名单：新增该路径免登录。

### 出向（后端 → 链科）
封装在 `PrinterGateway`，不对外暴露 REST。

### Admin（后台管理，仅新增「打印任务管理」）
打印店复用现有「门店管理」，打印机复用现有「商品管理」，均不新增界面。
- 打印任务管理（`/admin-api/mall/device/print-job/...`）：分页列表、详情、`POST .../query`（主动查链科状态）、`POST .../cancel`、`POST .../retry`。
- 权限：`device:print-job:*`（待对齐现有 device 权限命名）。

### App（下单计价，新增）
- 打印下单请求新增：`fileKey`/文件标识、SKU 基础规格、纸张/颜色等 `optionSelections`、份数。
- 后端调用链科文件页数接口获取 `pageCount`，失败时拒绝创建订单。
- 计价：打印专属计价器，价格 =（SKU 基础单价 + Option 加价）× 页数 × 份数；不影响普通商品价格接口。

## 3. DB

`sql/upgrade-2026-07-25-printer-shop.sql`（含回滚）。

- `yshop_device`：新增 `device_key`、`device_port`、`device_model`（通用设备型号，打印机对应链科 `driver_name`）。回调不带 token。
- `yshop_device_order`：新增 `task_id` varchar(64)、`extra_params` json（设备类型私有扩展参数；打印机放 `pageCount`/`dmPaperSize`/`dmCopies` 快照）。不加设备类型专用列，`callback_payload` 不入库（仅 debug 日志）。
- 均含租户/审计字段（继承 BaseDO）；不破坏存量列。

> 若现有表已有等价字段则复用，实现时核对后调整脚本。

## 4. MQ

- 复用 stream `order.pay.notice`。
- 新增消费者 `PrintPayNoticeConsumer`（**位于 device-biz**）：按 `orderType=device` + `deviceType=printer` 过滤，触发提交打印任务。
- 幂等键：orderNo（提交前查 DeviceOrder 是否已有 task_id）。
- 顺序：不依赖顺序；状态推进以链科回调为准。

## 5. 权限 / 数据范围

- 新表沿用租户隔离（BaseDO.tenant_id）；门店范围沿用现有派生逻辑。
- 回调端点免登录但靠 token 防护；不进租户拦截器（链科无租户上下文）。

## 6. 依赖

- 后端复用现有 HTTP 工具（`HttpClientUtils`）与 OSS 客户端；**无新增 Maven 依赖**（链科无 Java SDK，HTTP 直连）。
- 前端无新增框架依赖。

## 7. ADR

- 拟新增 ADR：`通用设备网关分发（DeviceGateway + 按 DeviceTypeEnum 注册表）`，记录 ICE_MAKER 硬编码重构决策。

## 8. 外部系统（预留）：配送平台

- 打印完成（DeviceOrder SUCCEEDED）后需向配送平台发起配送下单，送达用户。
- **接口契约暂未提供**。本期定义 `PrintDeliveryGateway` 占位接口，SUCCEEDED 时调用（空实现/记日志）；待配送平台契约补齐后另起 feature 接入，并补业务订单 status=2 的自动推进。
