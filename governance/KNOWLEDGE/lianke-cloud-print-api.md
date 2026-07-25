# 链科云打印 v3 接口文档（本地整理）

> 来源：官方 SDK 源码 [liankenet/cloud_printer_demo](https://github.com/liankenet/cloud_printer_demo)（Python / Go / PHP 三端对照）。
> 官方文档 https://docs.liankenet.com/api_doc 为 JS 渲染无法直接抓取，本文以 SDK 源码为准整理。
> 关联：BACKLOG-008 打印店。

## 1. 基础信息

| 项 | 值 |
|----|----|
| Base URL | `https://cloud.liankenet.com/api` |
| 认证 | 请求头 `ApiKey: {api_key}` |
| 设备凭证 | `deviceId` + `deviceKey`（扫云盒二维码 base64 解析），每次请求作为 query/form 参数携带 |
| 成功响应 | `{"code":200,"msg":"success","data":{...}}` |
| 失败响应 | `code != 200`，`msg` 为错误信息；HTTP 层错误状态码 ≥400 |

## 2. 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/device/device_info` | 设备信息/状态 |
| GET | `/device/async_refresh_device_info` | 异步刷新设备信息（含打印机） |
| GET | `/external_api/printer_list` | 获取云盒下打印机列表 |
| GET | `/print/printer_enum` | 枚举打印机 |
| GET | `/print/printer_params` | 获取打印机能力参数 |
| GET | `/device/printer_status` | 实时获取打印机状态 |
| POST | `/print/job` | 提交打印任务（multipart/form-data，异步返回 task_id） |
| GET | `/print/job` | 查询任务状态 |
| DELETE | `/print/job` | 取消任务 |

## 3. 接口明细

### 3.1 设备信息 `GET /device/device_info`

参数：`deviceId`、`deviceKey`。
返回 `data`：设备状态等信息。

### 3.2 打印机列表 `GET /external_api/printer_list`

参数：
- `deviceId`、`deviceKey`（必）
- `printerType`（选）：`1`=USB打印机，`2`=网络打印机，`3`=USB和网络打印机（默认 1）

返回：`data.row` 为打印机数组。每台含 `driver_name`（打印机型号，后续 `printerModel` 用此值）、USB 端口等。

### 3.3 打印机能力参数 `GET /print/printer_params`

参数：`deviceId`、`deviceKey`、`printerModel`（= printer_list 的 `driver_name`）。
> 注：Python SDK 用 `printerHash`，Go/PHP 用 `printerModel`，以 `printerModel`/`driver_name` 为准。
返回 `data`：纸张、颜色、份数等支持项，用于渲染打印规格（映射到商品 SKU）。

### 3.4 打印机状态 `GET /device/printer_status`

参数：`deviceId`、`deviceKey`、`usbPort`（USB 端口号）或 `printerHash`。

### 3.5 提交打印任务 `POST /print/job`

`Content-Type: multipart/form-data`。

参数：
- `deviceId`、`deviceKey`（必）
- `devicePort`（必，PHP 版）：云盒 USB 端口号
- `printerModel`（选）：打印机型号，= printer_list 的 `driver_name`
- `dmPaperSize`（必）：纸张大小，`9`=A4（默认）
- `dmCopies`（选）：打印份数
- `jobFile`（必）：打印文件。支持图片/Office/PDF/HTML，multipart 文件上传（表单字段名 `file`）；也支持**文件 URL 链接地址**
- `urlFileExt`（条件）：当 `jobFile` 为 URL 时，用此字段指明文件扩展名
- 其他可选参数经 `optional_array`/`Other` 透传

返回：`data.task_id`（异步任务 ID）。

### 3.6 查询任务状态 `GET /print/job`

参数：`deviceId`、`deviceKey`、`task_id`（+ `devicePort`）。
返回 `data`：任务状态信息（`task_state` 等）。

### 3.7 取消任务 `DELETE /print/job`

参数：`deviceId`、`deviceKey`、`task_id`（+ `devicePort`）。

## 4. 任务状态机 task_state

```
READY → PARSING → SENDING → SUCCESS
                          → FAILURE
取消：SET_REVOKE → REVOKED
```

| 状态 | 说明 |
|------|------|
| READY | 已就绪/排队 |
| PARSING | 解析文件中 |
| SENDING | 下发到打印机中 |
| SUCCESS | 打印成功 |
| FAILURE | 打印失败 |
| SET_REVOKE | 取消中 |
| REVOKED | 已取消 |

## 5. 回调 callbackUrl

提交任务时可传 `callbackUrl`，任务状态变化时链科**主动 POST JSON** 到该地址。**无签名/认证机制**。

回调 payload：
```json
{
  "device_id": "lk112312312312",
  "task_id": "bd85931c-38fa-4891-b1fa-5e1cf160ec12",
  "task_state": "SUCCESS",
  "create_time": "2022-03-01 17:15:02",
  "finish_time": "2022-03-01 17:30:58",
  "task_result": {"code": 503, "msg": "设备连接异常，请检查设备网络"}
}
```

字段：`device_id`、`task_id`、`task_state`（见 §4）、`create_time`、`finish_time`、`task_result{code,msg}`（失败原因，如 503 设备连接异常）。

> 安全：因无签名，接收端必须校验 `device_id` 归属本地设备、`task_id` 匹配本地任务、状态机只允许前进，三者任一不满足即丢弃。

## 6. 接入凭据

| 凭据 | 来源 |
|------|------|
| `ApiKey` | 链科开放平台注册获取 |
| `deviceId` | 扫云盒二维码 |
| `deviceKey` | 扫云盒二维码 |
