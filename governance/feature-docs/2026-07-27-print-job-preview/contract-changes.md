# 打印任务预览 - 契约变更

## API 变更（admin）

新增（不真实打印，纯预览计算）：

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/admin-api/device/print-job/preview` | 打印预览：取页数 + 计价，不落库 | `device:print-job:create` |

### 请求 `PrintJobPreviewReqVO`

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `shopId` | Long | 是 | 店铺 ID（确定 printer 设备与打印商品） |
| `fileUrl` | String | 是 | 打印文件可访问 URL（UploadFile 上传返回） |
| `fileExt` | String | 是 | 文件扩展名：`pdf`/`doc`/`docx` |
| `paperName` | String | 是 | 纸张 Option 名（用于解析 dmPaperSize 与 Option 加价） |
| `colorName` | String | 是 | 颜色 Option 名（用于解析 dmColor 与 Option 加价） |
| `copies` | Integer | 是 | 份数，≥1 |

### 响应 `PrintJobPreviewRespVO`

| 字段 | 类型 | 说明 |
|------|------|------|
| `pageCount` | Integer | 文件实际页数（链科 file_pages） |
| `unitPrice` | BigDecimal | 单价 = SKU 基础价 + Option 加价 |
| `basePrice` | BigDecimal | SKU 基础单价 |
| `optionDelta` | BigDecimal | Option 加价合计 |
| `copies` | Integer | 份数 |
| `totalPrice` | BigDecimal | 应付 = unitPrice × pageCount × copies |
| `deviceModel` | String | 打印机型号（展示用） |
| `paperName` / `colorName` | String | 回显所选规格 |

复用：`PrinterGateway.getFilePages`、`PrintSpecResolver`(dmPaperSize/dmColor)、`ProductOptionOrderApi.priceAndValidate`（Option 计价）。
抽取：`PrinterOrderService` 打印计价段抽为可复用方法，下单与预览共用同一口径。

## DB 变更

无新增表/字段。仅菜单/按钮权限 SQL（见下）。

## 权限 / 菜单 SQL

随功能交付 `sql/upgrade-2026-07-27-print-job-preview.sql`（幂等）：

- 在「打印任务」菜单（`mall/device/printJob/index`）下新增按钮权限 `device:print-job:create`（新建打印任务）。

## MQ / 外部系统

- 调用链科 `file_pages`（已封装），无新增外部系统。
- 不触发 MQ、不注册回调、不提交打印任务。

## 依赖 / 数据范围

- 复用 `UploadFile`（前端组件）与文件存储；上传 URL 需链科可公网访问（已验证）。
- 店铺、设备、商品、Option 查询保持租户隔离。
