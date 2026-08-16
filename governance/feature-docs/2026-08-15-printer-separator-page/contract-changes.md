# 打印订单分隔页契约变化

## 1. Feature 范围

- 目标仓库：`backend`、`admin`。
- 复用现有打印订单、`yshop_device_order`、链科打印回调和打印任务管理能力。
- 不新增用户端 API，不修改小程序和 DMS。

## 2. Backend API

### 2.0 租户参数

复用现有租户参数管理，不新增配置 API：

```text
key:   printer.separator.enabled
value: true / false
```

- 参数由管理后台“租户参数管理”页面创建或修改。
- 只有值为字符串 `true`（忽略大小写）时开启；缺失或其他值默认关闭。
- 开关在正文打印任务提交时固化到 `extraParams.separator.enabled`，只影响之后提交的订单。

### 2.1 新增：仅重试分隔页

```text
POST /admin-api/device/print-job/retry-separator?orderNo={deviceOrderNo}
```

权限：`device:print-job:retry`。

语义：

- 只接受分隔页阶段为 `SEPARATOR_FAILED` 的打印订单。
- 只提交分隔页，不重新提交正文。
- 成功返回 `true` 表示新的分隔页任务已被链科受理；不代表已经打印完成。
- `orderNo` 指 `yshop_device_order.order_no`，不使用业务订单号；订单不存在、非打印订单、非分隔页失败阶段或当前租户无权访问时返回现有业务错误/失败结果，不泄露其他租户数据。

### 2.2 现有接口语义调整

以下接口路径不变：

- `POST /admin-api/device/print-job/query`
- `POST /admin-api/device/print-job/cancel`
- `POST /app-api/device/printer/callback`

变化：

- `query` 查询 `DeviceOrder.taskId` 当前指向的任务，正文成功后该字段指向分隔页任务。
- `cancel` 取消分隔页任务时，不触发正文订单自动退款，而是进入 `SEPARATOR_FAILED`；取消正文任务仍沿用现有退款语义。
- 链科正文和分隔页均回调到同一个 callback URL，由订单快照阶段判断任务类型。

### 2.3 响应兼容性

- 现有打印任务分页和详情响应结构保持兼容，`extraParams` 继续返回 JSON 字符串。
- 管理端从 `extraParams.separator` 解析阶段和分隔页状态；不在通用设备 VO 中增加打印专属字段。
- 现有 C 端订单接口不新增字段；分隔页对用户不可见。

## 3. DeviceOrder 快照契约

不新增表、列、索引或唯一约束。沿用 `yshop_device_order.extra_params`，新增打印机私有结构：

```json
{
  "separator": {
    "eligible": true,
    "enabled": false,
    "templateVersion": "v1",
    "stage": "DOCUMENT",
    "status": "PENDING",
    "documentTaskId": null,
    "taskId": null,
    "objectKey": null,
    "expiresAt": null,
    "retryCount": 0,
    "snapshot": {
      "orderNo": "202608150001",
      "orderSequence": 27,
      "shopName": "打印店",
      "fileName": "合同.docx",
      "userAddress": "江苏省南通市崇川区测试路1号",
      "pageCount": 5,
      "copies": 2
    }
  }
}
```

约束：

- `eligible=true` 只由服务端为文件打印订单写入；客户端不能控制是否跳过分隔页。
- `enabled` 是正文任务提交时读取租户参数后的结果，配置缺失时为 `false`。
- `orderSequence` 和 `userAddress` 是业务订单创建时写入的展示快照，分隔页重试不重新读取业务订单。
- `snapshot` 只保存下单时已确认的业务字段，不保存 `deviceKey`、ApiKey 或其他凭证。
- `documentTaskId` 保存正文任务 ID；`taskId` 列保存当前活动任务 ID。
- `objectKey` 和 `expiresAt` 指向分隔页临时 OSS 对象；不长期保存带签名的读取 URL。
- `stage` 由服务端状态机维护，客户端不可提交或修改。
- 历史订单缺少 `separator.enabled` 时按关闭处理，避免部署后重复打印旧订单。

阶段与状态：

| `separator.stage` | `DeviceOrder.status` | 说明 |
|---|---|---|
| `DOCUMENT` | `CREATED/QUEUED/PROCESSING` | 正文任务阶段 |
| `SEPARATOR_PENDING` | `PROCESSING` | 正文成功，准备分隔页 |
| `SEPARATOR` | `QUEUED/PROCESSING` | 分隔页任务执行中 |
| `SEPARATOR_FAILED` | `PROCESSING` | 分隔页失败，可重试，不退款 |
| `COMPLETED` | `SUCCEEDED` | 正文和分隔页均成功 |

## 4. 外部系统：链科云打印 v3

### 4.1 分隔页任务请求

复用 `POST /print/job`，认证和设备凭证规则不变：

- Header：`ApiKey`，仅服务端配置。
- `deviceId`、`deviceKey`、`devicePort`、`printerModel` 从服务端设备配置读取。
- `jobFile` 为服务端生成并上传的 HTML URL。
- `urlFileExt=.html`。
- `htmlKernel=chrometopdf`。
- `dmCopies=1`、`dmColor=1`、`dmOrientation=1`、`dmDuplex=1`。
- `dmPaperSize` 沿用订单正文选择的纸张编码。
- `callbackUrl` 继续使用 `/app-api/device/printer/callback`。

链科返回 `task_id` 后只视为受理成功；本地必须保存任务 ID，最终成功以链科回调或主动查询为准。

### 4.2 HTML 内容

- 链科支持 HTML URL 作为 `jobFile`。
- 模板必须生成单页内容；订单字段在服务端 HTML 转义。
- 不允许把客户端传入的完整 HTML 作为分隔页模板。
- 模板版本由服务端维护并写入订单快照。

### 4.3 临时文件生命周期

- 分隔页 HTML 上传到专用 OSS 前缀，不使用 backend 本地临时文件。
- 临时对象默认保留 48 小时，实际时间必须覆盖链科排队、下载和后台重试窗口，并支持配置。
- 任务成功、最终失败或取消后进入清理流程；OSS 生命周期策略作为兜底。
- 临时对象过期后重试分隔页时，服务端根据快照重新生成 HTML，不重新打印正文。
- `yshop-module-infra-api` 增加通用临时文件能力，例如 `TemporaryFileApi`：上传临时对象、生成短时读取 URL、删除对象。

## 5. MQ / 事件

N/A：本期不新增 MQ topic 或消息 payload。分隔页提交复用正文成功回调后的现有打印编排，并使用订单级分布式锁防重复。

## 6. 权限与数据范围

- 新接口使用现有 `device:print-job:retry` 权限。
- 查询、取消和重试都固定限定当前租户的打印设备订单；不接受客户端传入 `tenantId` 或 `userId`。
- 链科回调无登录态，继续通过 `device_id`、当前任务 ID 和阶段状态机校验来源与幂等性。
- 分隔页快照和 HTML 中不得出现 `deviceKey`、ApiKey、文件服务内部凭证或其他敏感配置。

## 7. DB / 迁移 / 回滚

- DB：N/A，不新增表、列、索引或约束；复用既有 `infra_tenant_config` 表和 `extra_params` JSON。
- SQL：N/A，不新增 `sql/upgrade-*.sql`。
- 回滚：将租户参数 `printer.separator.enabled` 关闭后，新提交订单不再触发分隔页；已有订单按提交时固化的开关继续处理。删除 JSON 扩展不是必要回滚动作，避免破坏打印历史快照。

## 8. 依赖

- 增加 `yshop-module-device-biz-print` 对 `yshop-module-infra-api` 的直接依赖，用于调用 `TemporaryFileApi` 上传和清理生成的 HTML。
- 不新增 PDF 合并、Office 转换或浏览器运行时依赖。
- 不新增前端依赖。
