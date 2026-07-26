# 链科云打印 v3 接口文档（本地整理）

> 来源：官方 Postman Collection（链科云打印 v3 API 使用文档）+ 官方 SDK 源码 [liankenet/cloud_printer_demo](https://github.com/liankenet/cloud_printer_demo)。
> 官方文档 https://docs.liankenet.com/api_doc 为 JS 渲染无法直接抓取，本文以 Postman Collection + SDK 源码为准整理。
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
| GET | `/device/printer_status` | 实时获取打印机状态 |
| POST | `/device/async_device_reboot` | 重启设备 |
| GET | `/external_api/printer_list` | 获取云盒下打印机列表 |
| GET | `/print/printer_enum` | 获取支持的打印机型号列表 |
| POST | `/print/printer_enum` | 搜索支持的打印机型号 |
| GET | `/print/printer_params` | 获取打印机能力参数 |
| GET | `/print/paper_dimension_list` | 获取打印机支持的纸张尺寸 |
| POST | `/print/file_pages` | 根据文件 URL 获取 PDF/Word 页数 |
| POST | `/print/job` | 提交打印任务（multipart/form-data，异步返回 task_id） |
| GET | `/print/job` | 查询任务状态 |
| DELETE | `/print/job` | 取消任务 |
| POST | `/print/query_device_task` | 查询设备一天内打印任务 |
| POST | `/print/flush_jobs` | 清空排队中的任务 |
| POST | `/print/reset_printing_error_limit` | 解除打印失败限制 |
| POST | `/driver/uninstall_driver_event` | 提交未识别打印机适配申请 |
| GET | `/printer/refresh_network_printer` | 搜索局域网内网络打印机 |

## 3. 接口明细

### 3.1 设备信息 `GET /device/device_info`

参数：`deviceId`、`deviceKey`。

返回 `data.info`：

| 字段 | 说明 |
|------|------|
| `online` | `null`=从未开机，`1`=在线，`0`=离线 |
| `usb_port_num` | USB 端口数 |
| `expire_date` | 过期时间 |
| `is_expire` | 是否过期 |
| `device_type` | 设备类型 |
| `api_support` | API 支持 |
| `mobile_support` | 移动端支持 |
| `remote_support` | 远程支持 |

返回 `data.network`：网络信息（lan/wwan 的 IP、网关、DNS 等）。

### 3.2 异步刷新设备信息 `GET /device/async_refresh_device_info`

> 固件版本 ≥ 2.1.112 时无需调用，链科内部自动处理。

参数：`deviceId`、`deviceKey`。

返回 code：

| code | 说明 |
|------|------|
| 200 | 请求成功 |
| 401 | 正在刷新中 |
| 404 | 设备 ID 或密码错误 |
| 10009 | 请求频繁，单设备同时只允许调用一次 |

### 3.3 实时获取打印机状态 `GET /device/printer_status`

参数：`deviceId`、`deviceKey`、`usbPort`。

> 仅支持 `printer_list` 返回 `support_status=true` 的打印机。实时同步，返回较慢；同设备同 USB 口并发限制为 1。

返回 `data`：

| 字段 | 说明 |
|------|------|
| `headOpened` | 盖子已开启 |
| `paperJam` | 卡纸 |
| `outOfPaper` | 缺纸 |
| `outOfRibbon` | 缺碳带（标签机型） |
| `outOfInk` | 低墨量/碳粉（部分激光喷墨机型） |
| `pause` | 打印机暂停 |
| `printing` | 打印中 |
| `msg` | 信息 |
| `statusCode` | 状态码（部分机型） |
| `errCode` | 错误码（部分机型） |

错误码：`497` = 未检测到打印机。

### 3.4 重启设备 `POST /device/async_device_reboot`

`Content-Type: application/json`

```json
{"deviceId": "...", "deviceKey": "..."}
```

| code | 说明 |
|------|------|
| 200 | 重启成功 |
| 401 | 正在重启中 |
| 5002 | 设备已离线 |

### 3.5 打印机列表 `GET /external_api/printer_list`

参数：
- `deviceId`、`deviceKey`（必）
- `printerType`（选）：`1`=USB打印机，`2`=网络打印机，`3`=USB和网络打印机（默认 1）

返回 `data.row` 为打印机数组，`data.total` 为总数。每台打印机字段：

| 字段 | 说明 |
|------|------|
| `driver_name` | 打印机型号（后续 `printerModel` 用此值） |
| `printer_name` | 打印机型号名称 |
| `driver_type` | `0`=待适配，`1`=已适配，`2`=不支持 |
| `isPrinter` | `1`=打印机，`0`=非打印机 |
| `port` | 对应 `devicePort`（USB 口号）；网络打印机返回 631，此时 `devicePort` 填 1 |
| `support_status` | 是否支持额外状态查询指令 |
| `printer_species` | 打印机类型：`0`=未知，`1`=针式，`2`=小票，`3`=标签，`4`=激光，`5`=喷墨，`6`=热升华，`7`=证卡 |
| `printer_state` | 网络打印机状态：`idle`=就绪，`printing`=打印中，`stopped`=异常 |
| `ip_addr` | 网络打印机 IP（网络打印机独有） |
| `markers` | 墨盒信息（网络打印机独有） |

### 3.6 支持的打印机型号列表 `GET /print/printer_enum`

获取云服务器支持的所有打印机型号列表，无需设备参数。

### 3.7 搜索支持的打印机型号 `POST /print/printer_enum`

`Content-Type: application/json`

```json
{"query": "HP 1020"}
```

返回 `data` 为匹配的型号字符串数组。

### 3.8 打印机能力参数 `GET /print/printer_params`

参数：`printerModel`（= printer_list 的 `driver_name`）。

返回 `data.Capabilities`：纸张（Papers）、颜色（Color）、份数（Copies）、双面（Duplex）、纸张来源（Bins）、方向（Orientation）、纸张类型（MediaTypes）等支持项。返回 `data.DevMode`：默认值。用于配置商品 Option；其中纸张大小、颜色可通过 Option 加价。

> 建议调用后缓存数据，避免频繁请求。

### 3.9 纸张尺寸列表 `GET /print/paper_dimension_list`

参数：`printerModel`。

返回 `data` 为对象，key 为纸张名称，value 含：

| 字段 | 说明 |
|------|------|
| `paper_id` | 纸张 ID，对应 `dmPaperSize` |
| `physical_height` | 纸张物理高度，单位 0.1mm |
| `physical_width` | 纸张物理宽度，单位 0.1mm |
| `printable_height` | 可打印高度，单位 0.1mm |
| `printable_width` | 可打印宽度，单位 0.1mm |

### 3.10 获取文件页数 `POST /print/file_pages`

用于文件打印下单前获取 PDF/Word 文件的实际页数。接口当前处于测试阶段，限时免费且无 SLA；单次只支持一个文件，文件不超过 20MB，使用 URL 时链科下载文件应在约 5 秒内完成。禁止无限重复尝试相同错误文件。

`Content-Type: multipart/form-data`。

请求字段：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `deviceId` | 是 | 云盒设备 ID |
| `deviceKey` | 是 | 云盒密钥 |
| `devicePort` | 是 | 云盒 USB 端口 |
| `printerModel` | 是 | 打印机型号，通常取 `printer_list` 的 `driver_name` |
| `dmPaperSize` | 是 | 纸张大小编码；会影响最终页数，例如 A4 为 `9` |
| `jobFile` | 是 | PDF/Word 文件 URL |

成功响应：

```json
{
  "code": 200,
  "data": {
    "pages": 3
  },
  "msg": "success"
}
```

页数读取路径为 `data.pages`。`pages` 必须为正整数；接口失败、响应缺失或页数无效时，业务侧不得创建可支付的文件打印订单。

失败响应仍遵循通用约定：`code != 200`，具体原因读取 `msg`；HTTP 层错误状态码按网络失败处理。

安全与调用约束：

- `ApiKey` 只放请求头，不入库、不提交。
- `deviceKey` 只由服务端从设备配置读取。
- `jobFile` 必须是链科可访问的文件 URL；调用方应校验文件来源、扩展名和权限。
- 该接口只用于文件打印页数计算；照片打印数量由业务侧上传照片数量计算，不调用此接口。

### 3.11 提交打印任务 `POST /print/job`

`Content-Type: multipart/form-data`。

**基础参数：**

| 字段 | 必填 | 说明 |
|---|---:|---|
| `deviceId` | 是 | 设备 ID |
| `deviceKey` | 是 | 设备密钥 |
| `devicePort` | 是 | 设备端口（USB 口号，多 USB 口设备必填） |
| `printerModel` | 选 | 打印机型号，= printer_list 的 `driver_name` |
| `jobFile` | 是 | 打印文件。支持图片/Office/PDF/HTML；支持文件上传（form-data）或 **URL 链接**（多个链接用 `\n` 拼接）。纯文本传参会当作链接处理。如需传入打印机指令集（如 ESC 指令），需保存为 `.prn` 文件上传（此时其他打印参数不生效） |
| `urlFileExt` | 条件 | 当 `jobFile` 为 URL 时，指定文件扩展名如 `.pdf`、`.png` |
| `dmPaperSize` | 是 | 纸张大小，`9`=A4，`11`=A5。可取值见 `Capabilities.Papers`；默认值见 `DevMode.PaperSize`。自定义纸张时设为 `0` |
| `dmOrientation` | 选 | 方向：`1`=竖向，`2`=横向。默认见 `DevMode.Orientation` |
| `dmCopies` | 选 | 份数。最大不超过 `Capabilities.Copies` |
| `dmColor` | 选 | 颜色：`1`=黑白，`2`=彩色。默认见 `DevMode.Color` |
| `dmDefaultSource` | 选 | 纸张来源。可取值见 `Capabilities.Bins`；默认见 `DevMode.DefaultSource` |
| `dmDuplex` | 选 | 双面：`1`=关闭，`2`=长边，`3`=短边。默认见 `DevMode.Duplex` |
| `dmMediaType` | 选 | 纸张类型。可取值见 `Capabilities.MediaTypes`；默认见 `DevMode.MediaType` |
| `dmPaperLength` | 条件 | 自定义高，`dmPaperSize=0` 时生效，单位 0.1mm |
| `dmPaperWidth` | 条件 | 自定义宽，`dmPaperSize=0` 时生效，单位 0.1mm |
| `dmPrintQuality` | 选 | 打印质量：`-1`最低 ~ `-4`最高 |

**图片/文档处理参数：**

| 字段 | 必填 | 说明 |
|---|---:|---|
| `jpScale` | 选 | 自动缩放（取代 `jpAutoScale`，优先使用）：`fit`=自适应，`fitw`=宽度优先，`fith`=高度优先，`fill`=拉伸全图，`cover`=自动裁剪铺满，`xx%`=自定义百分比，`none`=关闭缩放 |
| `jpAutoScale` | 选 | 自动缩放（旧参数）：`4`=自适应，`0`=原图，`1`=宽度优先，`2`=高度优先，`3`=拉伸全图，`xx%`=自定义 |
| `jpAutoAlign` | 选 | 对齐：`z1`~`z9`（九宫格），默认 `z1` 左上 |
| `jpAutoRotate` | 选 | 自动旋转：`0`=关闭，`1`=开启。建议文档打印时开启 |
| `jpPageRange` | 选 | 页数范围，如 `1,2,3,5-10`。特殊值：`-1`=奇数页，`-2`=偶数页。为空则全部打印 |
| `pdfRev` | 选 | 文档逆序：`0`=关闭，`1`=开启。仅对文档有效 |

**高级参数：**

| 字段 | 必填 | 说明 |
|---|---:|---|
| `callbackUrl` | 选 | 打印结果回调地址（HTTPS），任务完成后 POST JSON 推送 |
| `reportDeviceStatus` | 选 | 拦截设备状态异常任务：`5001`=未配网，`5002`=已离线。默认开启 |
| `reportPrinterStatus` | 选 | 拦截打印机状态异常任务：`5011`=USB 口未插打印机 |
| `taskTicket` | 选 | 预览返回的任务凭证，可复用中间文件缩短打印时间（会导致 `jobFile` 无效） |
| `errLimitNum` | 选 | 允许连续出错任务数上限，默认 30，最大 30。触发后返回 `11203` |
| `isPreview` | 选 | 预览：`1` 时任务结果返回预览图片 |
| `htmlKernel` | 选 | HTML 转换内核：`wkhtml`、`chrometopdf`、`wkhtmltopdf`。建议 `chrometopdf` |
| `targetIp` | 选 | 局域网网口打印机 IP，此时 `devicePort` 固定填 `1` |

返回：`data.task_id`（异步任务 ID）。

> 该接口为异步接口，立即返回仅代表任务被接受，不表示打印完成。

### 3.12 查询任务状态 `GET /print/job`

参数：`deviceId`、`deviceKey`、`devicePort`、`task_id`。

> 建议使用 `callbackUrl` 回调代替轮询。如需轮询，建议间隔 10 秒。

返回 `data`：

| 字段 | 说明 |
|------|------|
| `task_state` | 任务状态（见 §4） |
| `task_result` | 打印结果（`code`=200 成功，非 200 失败，含 `msg`） |
| `task_result.data.file_total` | 文件总字节数 |
| `task_result.data.send_total` | 已发送字节数 |
| `task_result.data.total_page` | 总页数 |
| `task_done_time` | 完成时间 |
| `task_done_timestamp` | 完成时间戳 |

### 3.13 取消任务 `DELETE /print/job`

参数：`deviceId`、`deviceKey`、`devicePort`、`task_id`。

### 3.14 查询设备一天内打印任务 `POST /print/query_device_task`

`Content-Type: application/json`

```json
{"deviceId": "...", "deviceKey": "..."}
```

返回 `data.task_list` 数组，每条含 `task_id`、`status`、`result{code,msg}`、`create_at`、`updated_at` 等。

### 3.15 清空排队中的任务 `POST /print/flush_jobs`

`Content-Type: application/json`

```json
{"deviceId": "...", "deviceKey": "...", "devicePort": 1}
```

清除待打印队列，正在打印的任务不会取消。返回 `data.queue_num` 为清除的任务数。

### 3.16 解除打印失败限制 `POST /print/reset_printing_error_limit`

`Content-Type: application/json`

```json
{"deviceId": "...", "deviceKey": "...", "devicePort": "..."}
```

连续打印失败达 30 次后触发平台限制（返回 `11203`），可通过此接口解除。单设备每天最多调用 10 次。

| code | 说明 |
|------|------|
| 200 | 清除成功 |
| 10009 | 请求频繁 |
| 11200 | 当天重置次数超限 |
| 11201 | 暂无打印失败记录 |

### 3.17 提交未识别打印机适配申请 `POST /driver/uninstall_driver_event`

`Content-Type: application/json`

```json
{"deviceId": "...", "deviceKey": "...", "printerId": "1", "phone": "13512345678"}
```

`printerId` 为 `printer_list` 返回的 `id`。适配完成通知发送到手机号，72 小时内适配。

### 3.18 搜索局域网网络打印机 `GET /printer/refresh_network_printer`

参数：`deviceId`、`deviceKey`。

仅网络打印机使用，USB 打印机不可用。设备启动时自动调用一次，12 小时内重启只调用一次。

## 4. 任务状态机 task_state

```
READY → PARSING → SENDING → SUCCESS
                          → FAILURE
取消：SET_REVOKE → REVOKED
```

| 状态 | 说明 |
|------|------|
| READY | 排队中 |
| PARSING | 解析文件中 |
| SENDING | 下发到打印机中 |
| SUCCESS | 打印成功 |
| FAILURE | 打印失败 |
| SET_REVOKE | 标记为撤回 |
| REVOKED | 撤回成功 |

## 5. 回调 callbackUrl

提交任务时可传 `callbackUrl`（必须 HTTPS），任务状态变化时链科**主动 POST JSON** 到该地址。**无签名/认证机制**。HTTP 返回 200 即确认收到，否则重试三次（间隔 0、5、10 秒）后放弃。

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

## 6. 消息推送（设备/打印机状态）

2023-02-01 新增。可及时推送设备断线、打印机插拔等状态消息。需在管理后台设置回调地址。

## 7. 接入凭据

| 凭据 | 来源 |
|------|------|
| `ApiKey` | 链科开放平台注册获取 |
| `deviceId` | 扫云盒二维码（解析 token 参数，base64 解码后冒号前段） |
| `deviceKey` | 扫云盒二维码（解析 token 参数，base64 解码后冒号后段） |

## 8. 更新日志

| 日期 | 变更 |
|------|------|
| 2022-03-01 | 打印接口新增 `reportDeviceStatus`、`reportPrinterStatus`、`callbackUrl` 参数 |
| 2023-02-01 | 新增消息推送功能（设备断线、打印机插拔等） |
| 2023-02-07 | 新增连续打印失败错误重置 API |
| 2023-11-30 | 新增清空排队中的任务 API；更换域名 |
| 2024-01-11 | 优化提交任务 `jobFile` 参数描述 |
| 2024-02-21 | 增加 `jpScale` 参数描述 |
| 2024-10-28 | 增加对接前设备绑定提示 |
| 2025-07-03 | `refresh_device_info` 接口下线 |
| 2025-11-26 | 增加 `urlFileExt` 参数描述 |
