# printer-order-flow 契约变化

## 1. Feature 范围

- 目标仓库：`backend`、`admin`。
- 不修改 `miniapp` 和 `icepolar-dms`。
- 不新增商品类型字段。
- 不新增数据库唯一约束。

## 2. Backend API

### 2.0 初始化打印设备

设备管理页面触发 backend 初始化。云盒返回多台打印机时，固定使用 `data.row[0]`，不增加人工选择。

初始化成功后保存：

| 链科字段 | 本地字段/用途 |
|---|---|
| `data.row[0].driver_name` | `yshop_device.device_model`，后续作为 `printerModel` |
| `data.row[0].port` | `yshop_device.device_port`，后续作为 `devicePort` |
| `printer_params` | 打印能力，生成商品 Option |
| `paper_dimension_list.data` | 纸张名称与 `dmPaperSize` 映射 |

初始化前删除当前店铺下已有商品规格和 Option，初始化生成的纸张、颜色等 Option 默认加价为 0。该操作必须由页面二次确认，重复初始化会再次执行清理和重建。

### 2.0.1 管理端页面

新增“打印设备管理/能力同步”页面，支持按店铺查询设备、录入云盒凭证、初始化设备、预览打印能力、展示清理范围，以及确认后清理并重建商品规格和 Option。商品基础价格和新生成的 Option 加价继续由商品管理页面维护。

对应 admin 接口：

```text
GET  /admin-api/device/print-device/list-by-shop?shopId={id}
POST /admin-api/device/print-device/init          {shopId, deviceKey} → 保存凭证并返回能力预览(纸张/颜色/方向/双面+受影响商品)
POST /admin-api/device/print-device/sync-options  {shopId, paperNames} → 覆盖重建商品纸张/颜色 Option
```

权限：`device:print-device:query/init/sync`。`deviceKey` 仅写入服务端，列表/预览不明文回显（仅 `hasDeviceKey`）。

### 2.1 创建打印订单

```text
POST /app-api/device/printer/order
```

请求语义：创建一个尚未支付的打印业务订单，并同步创建关联的 printer `DeviceOrder`。

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `shopId` | Long | 是 | 店铺 ID |
| `productId` | Long | 是 | 店铺下打印商品 ID |
| `spec` | String | 是 | 现有商品 SKU 组合；纸张大小和颜色不放在 SKU 中 |
| `optionSelections` | Array | 是 | 现有商品 Option 选择，至少包含纸张大小和颜色；加价按系统 Option 价格计算 |
| `copies` | Integer | 是 | 打印份数，必须大于 0 |
| `fileKey` | String | 文件打印是 | 文件存储标识；用于生成链科可访问 URL |
| `fileUrl` | String | 文件打印是 | 传给链科 `jobFile` 的 URL；必须通过来源/格式校验 |
| `fileName` | String | 文件打印是 | 原文件名 |
| `fileExt` | String | 文件打印是 | 例如 `pdf`、`docx` |
| `photoFiles` | Array | 照片打印是 | 照片文件标识或 URL 列表 |

`pageCount` 不属于可信请求字段。文件打印页数由 backend 调用链科 `file_pages` 后得到。

响应至少包含：

```json
{
  "code": 0,
  "data": {
    "orderNo": "string",
    "payPrice": 2.00,
    "productType": "FILE_PRINT",
    "pageCount": 5,
    "photoCount": 0,
    "copies": 2
  },
  "msg": "success"
}
```

订单创建响应仍需与现有订单创建/支付调用方式对齐；链科页数响应字段已冻结为 `data.pages`，实现时按该字段生成内部 `pageCount`。

### 2.2 权限与数据范围

- 使用当前登录用户和租户上下文。
- `productId` 必须属于 `shopId`，商品和分类查询必须保留租户隔离。
- 文件标识/URL 必须属于当前用户或当前租户允许的文件范围。
- 客户端不得提交 `deviceKey`、最终价格或服务端页数作为可信值。

## 3. 外部系统：链科文件页数接口

```text
POST https://cloud.liankenet.com/api/print/file_pages
Content-Type: multipart/form-data
Header: ApiKey: {LIANKE_PRINT_API_KEY}
```

请求字段：

| 字段 | 来源 |
|---|---|
| `deviceId` | 店铺 printer 设备代码 |
| `deviceKey` | `yshop_device.device_key` |
| `devicePort` | `yshop_device.device_port` |
| `printerModel` | `yshop_device.device_model` |
| `dmPaperSize` | 纸张大小 Option 映射 |
| `jobFile` | PDF/Word 文件 URL |

接口限制按当前供应方资料记录：单次一个文件、文件不超过 20MB、URL 下载应在约 5 秒内完成；该服务当前为测试期免费服务且无 SLA，backend 必须设置超时并将失败转为可识别业务错误。

### 3.1 响应契约

成功响应已确认：

```json
{
  "code": 200,
  "data": {
    "pages": 3
  },
  "msg": "success"
}
```

页数路径为 `data.pages`，类型为正整数。

backend 内部统一映射为：

```json
{
  "success": true,
  "pageCount": 5,
  "message": null
}
```

## 4. 现有事件契约

- 继续复用 Redis Stream：`order.pay.notice`。
- 过滤条件：业务订单 `orderType=device`，设备订单 `deviceType=printer`。
- 消费成功后调用现有打印任务提交编排，不新增支付事件。

## 5. DeviceOrder 快照契约

`yshop_device_order.extra_params` JSON 至少包含：

```json
{
  "productType": "FILE_PRINT|PHOTO_PRINT",
  "categoryName": "文件打印|照片打印",
  "productId": 100,
  "sku": "默认",
  "specSnapshot": {},
  "optionSnapshot": [],
  "pageCount": 5,
  "photoCount": 0,
  "copies": 2,
  "fileKey": "printer/2026/a.pdf",
  "fileName": "a.pdf",
  "fileExt": "pdf",
  "dmPaperSize": 9
}
```

短时签名 URL不作为长期凭证保存；正式 `/print/job` 提交时重新取得。

## 6. 数据库契约

- 无新增表。
- 无新增列。
- 无新增唯一约束。
- 继续使用 `yshop_device.device_key/device_port/device_model`。
- 继续使用 `yshop_device_order.task_id/extra_params`。
- 不修改基础 SQL；本 feature 无升级脚本。

## 7. 配置契约

复用：

- `LIANKE_PRINT_HOST`，默认 `https://cloud.liankenet.com/api`。
- `LIANKE_PRINT_API_KEY`。
- `LIANKE_PRINT_CALLBACK_BASE_URL`。

建议新增文件页数接口超时配置；若不新增配置，则复用现有 HTTP 客户端超时并在文档中固定默认值。ApiKey、deviceKey 不得写入仓库、日志或测试报告。
