# 打印任务预览 - 契约变更

## API 变更（admin）

新增（不真实打印；页数/计价与图片预览分离）：

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/admin-api/device/print-job/preview` | 图片预览：校验设备规格并提交链科预览图任务，不取页数、不计价，返回 `taskId` | `device:print-job:create` |
| GET | `/admin-api/device/print-job/preview-result` | 轮询预览图：按 `taskId` 返回 `taskState`/`previewImages[]`/`taskTicket` | `device:print-job:create` |

### 请求 `PrintJobPreviewReqVO`

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `shopId` | Long | 是 | 店铺 ID（确定 printer 设备与打印商品） |
| `fileUrl` | String | 是 | 打印文件可访问 URL（UploadFile 上传返回） |
| `fileExt` | String | 是 | 文件扩展名：`pdf`/`doc`/`docx` |
| `paperName` | String | 是 | 纸张 Option 名（用于解析 dmPaperSize 与 Option 加价） |
| `colorName` | String | 是 | 颜色 Option 名（用于解析 dmColor 与 Option 加价） |
| `orientationName` / `duplexName` | String | 否 | 方向/双面 Option 名 |
| `copies` | Integer | 是 | 份数，≥1 |
| `jpPageRange` | String | 否 | 预览页码范围，如 `1,2,3,4,5-10`；空=全部页，`-1`=奇数页，`-2`=偶数页 |

### 响应 `PrintJobPreviewRespVO`

| 字段 | 类型 | 说明 |
|------|------|------|
| `pageCount` | Integer | 文件实际页数；图片预览接口不返回，由独立计价接口提供 |
| `unitPrice` | BigDecimal | 单价；图片预览接口不返回 |
| `basePrice` | BigDecimal | SKU 基础单价；图片预览接口不返回 |
| `optionDelta` | BigDecimal | Option 加价合计；图片预览接口不返回 |
| `copies` | Integer | 份数 |
| `totalPrice` | BigDecimal | 应付 = unitPrice × pageCount × copies；图片预览接口不返回 |
| `deviceModel` | String | 打印机型号（展示用） |
| `paperName` / `colorName` | String | 回显所选规格 |
| `taskId` | String | 链科预览图任务 ID（isPreview=1 提交返回），用于轮询 preview-result |

### 预览图轮询 `GET /preview-result`

请求参数：`taskId`（String，必填）、`shopId`（Long，必填，用于定位店铺 printer 设备凭证后查询链科）。

响应 `PrintJobPreviewImageRespVO`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `taskState` | String | 链科任务状态：PARSING/SENDING/SUCCESS/FAILURE 等 |
| `finished` | Boolean | 是否已出结果（SUCCESS 或 FAILURE） |
| `previewImages` | List\<String\> | 每页预览图 URL（仅 SUCCESS 时有值，带时效签名） |
| `taskTicket` | String | 链科预览任务凭证（仅返回前端，不落库） |
| `resultCode` / `resultMsg` | Integer/String | 失败时链科 task_result.code/msg（如 502 设备端下载文件失败） |

图片预览复用：`PrintSpecResolver`（dmPaperSize/dmColor）；页数/计价接口单独复用 `PrinterGateway.getFilePages` 与 `ProductOptionOrderApi.priceAndValidate`。
抽取：`PrinterOrderService` 打印计价段抽为可复用方法，下单与预览共用同一口径。

## DB 变更

无新增表/字段。仅菜单/按钮权限 SQL（见下）。

## 权限 / 菜单 SQL

随功能交付 `sql/upgrade-2026-07-27-print-job-preview.sql`（幂等）：

- 在「打印任务」菜单（`mall/device/printJob/index`）下新增按钮权限 `device:print-job:create`（新建打印任务）。

## MQ / 外部系统

- `/admin-api/device/print-job/preview` 不调用链科 `file_pages`，只提交 `isPreview=1` 预览任务。
- `jpPageRange` 原样透传链科，用于限制预览页码范围。
- 页数/计价由独立的 C 端 `/app-api/device/printer/page-count` 提供。
- 预览图：调用链科 `POST /print/job`（`isPreview=1`）提交预览任务 + `GET /print/job` 轮询取 `img_list`（已实测），仍不真实打印、不下发打印机。
- 不触发 MQ、不注册回调。

## 依赖 / 数据范围

- 复用 `UploadFile`（前端组件）与文件存储；上传 URL 需链科可公网访问（已验证）。
- 店铺、设备、商品、Option 查询保持租户隔离。
