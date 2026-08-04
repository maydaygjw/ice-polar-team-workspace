# 打印接口（App 端与管理后台）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案，直接 toast 即可。
>
> 登录要求逐接口标注；需登录的请求头：`Authorization: Bearer <token>`。
>
> 源码：App 端位于 `backend/yshop-module-device/yshop-module-device-biz-print/.../controller/app/`；管理后台位于 `.../controller/admin/printerorder/`。
>
> **整体流程**：附近门店 → 门店详情（拿纸张/颜色能力）→ **上传文件拿 fileUrl** →（可选）获取页数/计价 → 提交文件预览并轮询预览图 → 创建订单 → 查询打印订单列表/详情 → 走现有订单支付接口付款 → 轮询真实打印进度 →（如配送）轮询配送进度。支付成功后由后端自动提交真实打印任务给链科云打印。

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|:---:|
| POST | `/app-api/infra/file/upload` | 上传文件（拿 fileUrl） | ❌ |
| GET | `/app-api/device/printer/shop/nearby` | 附近可打印门店列表 | ❌ |
| GET | `/app-api/device/printer/shop/detail` | 打印店详情（纸张/颜色能力） | ❌ |
| POST | `/app-api/device/printer/page-count` | 获取文件页数与计价，不生成预览图 | ✅ |
| POST | `/app-api/device/printer/preview` | 提交文件预览图任务，不真实打印 | ✅ |
| GET | `/app-api/device/printer/preview-result` | 轮询文件预览图任务 | ✅ |
| POST | `/app-api/device/printer/order` | 创建打印订单 | ✅ |
| GET | `/app-api/device/printer/order/list` | 打印订单列表（含打印特殊信息） | ✅ |
| GET | `/app-api/device/printer/order/detail` | 打印订单详情（含文件/选项/任务信息） | ✅ |
| GET | `/app-api/device/printer/progress` | 打印进度（前端轮询） | ✅ |
| GET | `/app-api/device/printer/delivery/progress` | 配送进度（前端轮询） | ✅ |
| POST | `/app-api/device/printer/callback` | 链科打印任务状态回调（**外部系统用，前端不调**） | ❌ |

---

## 1. 上传文件 `POST /app-api/infra/file/upload`

无需登录。`page-count` / `preview` / `order` 需要的 `fileUrl` 都从这里拿。multipart 表单上传。

**表单字段**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | **是** | 文件附件 |
| path | string | 否 | 自定义存储路径；不传则后端自动生成（`yshop/drink/日期/文件名_时间戳.扩展名`） |

```bash
curl -X POST 'https://<host>/app-api/infra/file/upload' \
  -F 'file=@/path/简历.pdf'
```

**响应**：`data` 为文件完整可访问 URL。

```json
{ "code": 0, "msg": "", "data": "https://cdn.example.com/yshop/drink/20260730/简历_1786000000000.pdf" }
```

**前端取数**：上传后从本地文件即可拿到 `fileName`（原文件名）和 `fileExt`（扩展名），`data` 即 `fileUrl`；`fileKey` 可传存储路径或留空（后端下单只透传，非必填）。

---

## 2. 附近可打印门店 `GET /app-api/device/printer/shop/nearby`

无需登录，无参数。返回所有**已初始化打印机**的门店列表，前端按经纬度自行排序/算距离。

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "shopId": 72,
      "shopName": "西湖文三店",
      "address": "浙江省杭州市西湖区文三路 100 号",
      "lng": "120.15507",
      "lat": "30.27415",
      "printerOnline": true,
      "deviceModel": "POS-80C"
    }
  ]
}
```

- `printerOnline`：打印机是否在线，离线门店建议置灰或提示。
- 无可打印门店时 `data: []`。

---

## 3. 打印店详情 `GET /app-api/device/printer/shop/detail`

无需登录。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | long | 是 | 店铺 ID |

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "shopId": 72,
    "shopName": "西湖文三店",
    "address": "浙江省杭州市西湖区文三路 100 号",
    "lng": "120.15507",
    "lat": "30.27415",
    "printerOnline": true,
    "canOrder": true,
    "deviceModel": "POS-80C",
    "paperNames": ["A4 210 x 297 毫米", "A5 148 x 210 毫米"],
    "colorNames": ["黑白", "彩色"]
  }
}
```

- `canOrder`：设备已初始化且店铺营业才可下单，`false` 时前端禁止进入下单。
- `paperNames`：该设备支持的纸张（下单/预览的 `paperName` 从此选）；拉取失败时可能为空数组。
- `colorNames`：固定 `["黑白", "彩色"]`。
- 店铺无已初始化打印机时报错 `PRINT_DEVICE_NOT_FOUND`。

---

## 4. 获取文件页数与计价 `POST /app-api/device/printer/page-count`

**需登录**。文件打印专用：解析文件实际页数并按「(SKU 基础价 + Option 加价) × 页数 × 份数」计价，不产生订单，也不提交预览图任务。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | long | **是** | 店铺 ID |
| fileUrl | string | **是** | 打印文件可访问 URL |
| fileExt | string | **是** | 文件扩展名：pdf / doc / docx |
| paperName | string | **是** | 纸张 Option 名（取自详情 `paperNames`） |
| colorName | string | **是** | 颜色 Option 名：`黑白` / `彩色` |
| copies | int | **是** | 份数，≥1 |

**请求样例**

```json
{
  "shopId": 72,
  "fileUrl": "https://cdn.example.com/files/resume.pdf",
  "fileExt": "pdf",
  "paperName": "A4 210 x 297 毫米",
  "colorName": "黑白",
  "copies": 2
}
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "pageCount": 5,
    "basePrice": 0.10,
    "optionDelta": 0.00,
    "unitPrice": 0.10,
    "copies": 2,
    "totalPrice": 1.00,
    "deviceModel": "POS-80C",
    "paperName": "A4 210 x 297 毫米",
    "colorName": "黑白"
  }
}
```

- `totalPrice = unitPrice × pageCount × copies`，与下单同一计价口径。
- `pageCount` 由链科解析文件得出，前端无需自己算页数。
- 该接口只返回页数和价格，不返回 `taskId`，不会生成预览图片。

---

## 5. 提交文件预览 `POST /app-api/device/printer/preview`

**需登录**。该接口生成链科异步预览任务，不真实打印、不创建订单、不扣款。响应会同时返回页数和计价结果，以及用于轮询图片的 `taskId`。

### Body

请求字段与 [获取文件页数与计价](#4-获取文件页数与计价-post-app-apideviceprinterpage-count) 相同。

```json
{
  "shopId": 72,
  "fileUrl": "https://cdn.example.com/files/resume.pdf",
  "fileExt": "pdf",
  "paperName": "A4 210 x 297 毫米",
  "colorName": "黑白",
  "copies": 2
}
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "pageCount": 5,
    "basePrice": 0.10,
    "optionDelta": 0.00,
    "unitPrice": 0.10,
    "copies": 2,
    "totalPrice": 1.00,
    "deviceModel": "POS-80C",
    "paperName": "A4 210 x 297 毫米",
    "colorName": "黑白",
    "taskId": "lianke-task-123"
  }
}
```

- `taskId` 为空表示链科预览任务提交失败；此时仍可能返回页数和计价结果，但不能继续获取预览图。
- 预览任务只生成中间预览图，不会下发打印机。
- 生成完成后使用下一节接口轮询 `previewImages`。

---

## 6. 轮询文件预览图 `GET /app-api/device/printer/preview-result`

**需登录**。提交预览接口返回 `taskId` 后，前端建议每 500ms–3s 请求一次，直到 `finished=true`。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| shopId | long | **是** | 店铺 ID，用于定位打印机凭证 |
| taskId | string | **是** | 提交预览接口返回的链科任务 ID |

```http
GET /app-api/device/printer/preview-result?shopId=72&taskId=lianke-task-123
Authorization: Bearer <token>
```

### 处理中响应

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "taskState": "PARSING",
    "finished": false,
    "previewImages": null,
    "taskTicket": null,
    "resultCode": null,
    "resultMsg": null
  }
}
```

### 成功响应

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "taskState": "SUCCESS",
    "finished": true,
    "previewImages": [
      "https://preview.liankenet.com/page-1.jpg?auth_key=...",
      "https://preview.liankenet.com/page-2.jpg?auth_key=..."
    ],
    "taskTicket": "preview-ticket-123",
    "resultCode": null,
    "resultMsg": null
  }
}
```

### 失败响应

当 `taskState` 为 `FAILURE` 或 `REVOKED` 时，`finished=true`，前端停止轮询并展示 `resultMsg`；此时通常没有 `previewImages`。

> `preview-result` 是预览图轮询接口，不是真实打印进度接口。真实打印任务使用 [打印进度](#10-打印进度-get-app-apideviceprinterprogress) 查询。

---

## 7. 创建打印订单 `POST /app-api/device/printer/order`

**需登录**。只创建订单（幂等），**支付调现有订单支付接口**；支付成功后后端自动提交打印任务。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 建议传 | 幂等键，防重复下单（重试/双击用同一个值） |
| shopId | long | **是** | 店铺 ID |
| productId | long | **是** | 打印商品 ID |
| spec | string | **是** | 商品 SKU 规格（`\|` 分隔，单规格传 `默认`） |
| optionSelections | array | **是** | Option 选择，**至少含纸张与颜色**，结构见下 |
| copies | int | **是** | 份数，≥1 |
| fileKey | string | 文件打印 | 文件存储标识 |
| fileUrl | string | 文件打印 | 文件可访问 URL（传给链科 jobFile） |
| fileName | string | 文件打印 | 原文件名 |
| fileExt | string | 文件打印 | 文件扩展名，如 pdf / docx |
| photoFiles | string[] | 照片打印 | 照片文件 URL 列表 |

**optionSelections 项（ProductOptionSelectionDTO）**

| 字段 | 类型 | 说明 |
|------|------|------|
| groupId | long | 选项分组 ID |
| optionId | long | 选项 ID |
| groupName | string | 分组名（如 `纸张`） |
| optionName | string | 选项名（如 `A4 210 x 297 毫米`、`黑白`） |
| price | number | 选项加价（如 0.00） |

**请求样例（文件打印）**

```json
{
  "requestId": "req-20260730-001",
  "shopId": 72,
  "productId": 501,
  "spec": "默认",
  "optionSelections": [
    { "groupId": 1, "optionId": 11, "groupName": "纸张", "optionName": "A4 210 x 297 毫米", "price": 0.00 },
    { "groupId": 2, "optionId": 21, "groupName": "颜色", "optionName": "黑白", "price": 0.00 }
  ],
  "copies": 2,
  "fileKey": "print/20260730/abc.pdf",
  "fileUrl": "https://cdn.example.com/files/resume.pdf",
  "fileName": "简历.pdf",
  "fileExt": "pdf"
}
```

照片打印则去掉 file* 字段，传：

```json
{ "photoFiles": ["https://cdn.example.com/p1.jpg", "https://cdn.example.com/p2.jpg"] }
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "orderNo": "202607301200001",
    "payPrice": 1.00,
    "productType": "FILE_PRINT",
    "pageCount": 5,
    "photoCount": null,
    "copies": 2
  }
}
```

- `orderNo`：拿去调支付接口；后续进度轮询也用它。
- `productType`：`FILE_PRINT`（文件打印）/ `PHOTO_PRINT`（照片打印）。
- `pageCount` 仅文件打印有值，`photoCount` 仅照片打印有值。

> 安全约束：`deviceKey`、最终价格、服务端页数都不允许客户端传入，以前端预览价格展示、以响应 `payPrice` 为准。

---

## 8. 打印订单列表 `GET /app-api/device/printer/order/list`

**需登录**。该接口是打印专用订单列表，底层复用订单模块查询支付金额、支付状态和业务状态，同时读取设备订单快照中的打印信息；不要用普通 `/app-api/order/list` 代替。

### Query 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| page | int | 否 | `1` | 页码 |
| limit | int | 否 | `10` | 每页数量，最大 `100` |
| operationStatus | string | 否 | — | `CREATED` / `QUEUED` / `PROCESSING` / `SUCCEEDED` / `FAILED` / `CANCELLED` |

### 请求样例

```http
GET /app-api/device/printer/order/list?page=1&limit=10&operationStatus=PROCESSING
Authorization: Bearer <token>
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "orderNo": "202607301200001",
      "productType": "FILE_PRINT",
      "pageCount": 5,
      "photoCount": 0,
      "copies": 2,
      "fileName": "简历.pdf",
      "fileExt": "pdf",
      "paperName": "A4 210 x 297 毫米",
      "colorName": "黑白",
      "payPrice": 1.00,
      "paid": 0,
      "refundStatus": 0,
      "refundPrice": 0.00,
      "payTime": null,
      "operationStatus": "PROCESSING",
      "businessStatus": 0,
      "failureReason": null,
      "finished": false,
      "createTime": "2026-07-30 12:00:00"
    }
  ]
}
```

列表为空时返回 `data: []`。当 `paid=0` 时，可使用 `orderNo` 作为订单模块支付接口的 `uni` 参数。

退款字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| refundStatus | int | `0` 正常、`1` 退款中、`2` 已退款、`3` 退款已拒绝 |
| refundPrice | number | 已退款金额；未退款时通常为 `0` |

---

## 9. 打印订单详情 `GET /app-api/device/printer/order/detail`

**需登录**。详情接口返回列表字段，并补充打印文件、Option 选择快照和链科任务 ID。

### Query 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| orderNo | string | **是** | 打印订单号，即创建接口返回的 `orderNo` |

### 请求样例

```http
GET /app-api/device/printer/order/detail?orderNo=202607301200001
Authorization: Bearer <token>
```

### 响应样例

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "orderNo": "202607301200001",
    "productType": "FILE_PRINT",
    "pageCount": 5,
    "photoCount": 0,
    "copies": 2,
    "fileKey": "print/20260730/abc.pdf",
    "fileUrl": "https://cdn.example.com/files/resume.pdf",
    "fileName": "简历.pdf",
    "fileExt": "pdf",
    "paperName": "A4 210 x 297 毫米",
    "colorName": "黑白",
    "optionSelections": [
      {
        "groupId": 1,
        "optionId": 11,
        "groupName": "纸张",
        "optionName": "A4 210 x 297 毫米",
        "price": 0.00
      },
      {
        "groupId": 2,
        "optionId": 21,
        "groupName": "颜色",
        "optionName": "黑白",
        "price": 0.00
      }
    ],
    "taskId": null,
    "payPrice": 1.00,
    "paid": 0,
    "refundStatus": 0,
    "refundPrice": 0.00,
    "payTime": null,
    "operationStatus": "CREATED",
    "businessStatus": 0,
    "failureReason": null,
    "finished": false,
    "createTime": "2026-07-30 12:00:00"
  }
}
```

订单不存在、不是打印订单或不属于当前用户时返回 `PRINT_ORDER_NOT_EXISTS`，不会泄露其他用户的订单信息。

支付仍调用通用订单接口：

```http
POST /app-api/order/pay
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "uni": "202607301200001",
  "from": "routine",
  "paytype": "weixin"
}
```

支付完成后重新请求本接口确认 `paid=1`，再开始轮询打印进度。

退款状态由订单模块返回：`refundStatus=1` 表示退款申请处理中，`refundStatus=2` 表示已退款，`refundStatus=3` 表示退款申请被拒绝。详情接口同时返回 `refundPrice`。

---

## 10. 打印进度 `GET /app-api/device/printer/progress`

**需登录**，前端轮询（建议 2–3s 一次）。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderNo | string | 是 | 业务订单号 |

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "operationStatus": "PROCESSING",
    "businessStatus": 0,
    "failureReason": null,
    "finished": false,
    "payPrice": 1.00
  }
}
```

| 字段 | 说明 |
|------|------|
| operationStatus | 设备订单状态：`CREATED` / `QUEUED` / `PROCESSING` / `SUCCEEDED` / `FAILED` / `CANCELLED` |
| businessStatus | 业务订单主状态：0 待制作 / 1 配送中 / 2 已送达 / 3 已完成 |
| failureReason | 失败原因，`FAILED` / `CANCELLED` 时有值，可直接展示 |
| finished | 是否终态（SUCCEEDED/FAILED/CANCELLED），**为 true 时前端停止轮询** |

---

## 11. 配送进度 `GET /app-api/device/printer/delivery/progress`

**需登录**，仅配送订单使用，前端轮询。

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderNo | string | 是 | 业务订单号 |

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "deliveryStatus": "DELIVERING",
    "riderName": "王师傅",
    "riderMobile": "13800138000",
    "deliveryOrderId": "BD123456789",
    "deliveryUid": "202607301200001",
    "events": [
      { "state": "10", "local": "PENDING", "time": "2026-07-30 12:01:00" },
      { "state": "20", "local": "DELIVERING", "time": "2026-07-30 12:05:00" }
    ]
  }
}
```

- `deliveryStatus`：`PENDING`（待配送）/ `DELIVERING`（配送中）/ `DELIVERED`（已送达）/ `COMPLETED`（已完成）/ `CANCELLED`（已取消）。
- `riderName` / `riderMobile`：派单后才有值。
- `events`：配送状态时间线（按回调顺序），`state` 为配送平台原始状态码，`local` 为归一化状态。

---

## 12. 打印回调 `POST /app-api/device/printer/callback`

**链科云平台调用，前端不要调。** 无登录、无签名，后端靠 device_id / task_id / 状态机三重校验防伪造；始终返回成功避免链科重投。

---

## 对接提示

- **下单前**：先 `shop/detail` 确认 `canOrder=true`；只需要页数/价格时调用 `page-count`，需要查看排版时调用 `preview` 后轮询 `preview-result`。
- **查询**：订单列表使用 `order/list`，详情使用 `order/detail?orderNo=`；普通订单接口不会返回打印文件、纸张、颜色、页数等扩展信息。
- **支付**：`order` 返回 `orderNo` 后调现有订单支付接口；未支付不会进入打印队列。
- **支付状态**：使用打印订单列表/详情返回的 `paid` 判断是否展示支付按钮；支付后重新查询详情确认 `paid=1`。
- **退款状态**：使用打印订单列表/详情返回的 `refundStatus` 展示退款中、已退款或退款已拒绝；`refundPrice` 为已退款金额。
- **预览轮询**：`preview-result` 的 `finished=true` 即停止；成功时展示 `previewImages`，失败时展示 `resultMsg`。
- **打印轮询**：真实支付并创建打印任务后，使用 `progress`；其 `finished=true` 即停止，`FAILED` 时展示 `failureReason`。
- **幂等**：下单重试、网络超时重发必须用同一个 `requestId`，后端按幂等键去重。
- 本地启动后端后可在线查看 API 文档：`http://localhost:8888/doc.html`。

---

## 11. 管理后台打印订单查询

管理后台接口用于查询当前租户的打印设备订单，不复用仅限当前 App 用户的打印订单接口。所有接口统一返回 `CommonResult`，分页接口的 `data` 为 `PageResult`。

权限：`device:printer-order:query`。

### 11.1 打印订单分页 `GET /admin-api/device/printer-order/page`

**Query 参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | `1` | 页码 |
| pageSize | int | 否 | `10` | 每页数量 |
| bizOrderId | string | 否 | — | 关联商户订单号 |
| taskId | string | 否 | — | 链科打印任务 ID |
| deviceCode | string | 否 | — | 打印设备号 |
| status | string | 否 | — | 设备打印状态：`CREATED` / `QUEUED` / `PROCESSING` / `SUCCEEDED` / `FAILED` / `CANCELLED` |
| userId | string | 否 | — | 下单用户 ID |

**请求样例**

```http
GET /admin-api/device/printer-order/page?pageNo=1&pageSize=10&status=PROCESSING
Authorization: Bearer <token>
```

**响应样例**

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "list": [
      {
        "id": 230,
        "orderNo": "2083344313370017792",
        "bizOrderId": "2083344313370017792",
        "deviceCode": "lk10gf25368889",
        "deviceType": "printer",
        "operationType": "printer_order",
        "userId": "57",
        "operationStatus": "PROCESSING",
        "taskId": "task-202608010001",
        "failureReason": null,
        "startedAt": "2026-08-01 08:16:00",
        "finishedAt": null,
        "createTime": "2026-08-01 08:09:26",
        "printParams": {
          "productType": "FILE_PRINT",
          "pageCount": 1,
          "photoCount": 0,
          "copies": 1,
          "fileName": "授权委托书.docx",
          "fileExt": "docx",
          "paperName": "A4 210 x 297 毫米",
          "colorName": "黑白",
          "optionSelections": []
        },
        "paymentInfo": {
          "orderId": "2083344313370017792",
          "uid": 57,
          "orderType": "device",
          "totalPrice": 0.50,
          "payPrice": 0.50,
          "paid": 1,
          "payType": "yue",
          "payTime": "2026-08-01 08:15:24",
          "status": 0,
          "refundStatus": 0,
          "refundPrice": 0,
          "shopId": 75,
          "shopName": "打印店",
          "createTime": "2026-08-01 08:09:26"
        }
      }
    ],
    "total": 1
  }
}
```

### 11.2 打印订单详情 `GET /admin-api/device/printer-order/get`

**Query 参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| orderNo | string | **是** | 设备打印订单号，即响应中的 `orderNo` |

**请求样例**

```http
GET /admin-api/device/printer-order/get?orderNo=2083344313370017792
Authorization: Bearer <token>
```

响应结构与分页项一致；详情可返回 `printParams.fileKey`、`printParams.fileUrl` 和完整的 `optionSelections`。

### 11.3 字段与安全规则

- 后端固定筛选 `deviceType=printer` 且 `deleted=0` 的设备订单；租户条件由多租户拦截器追加。
- `paymentInfo` 由订单模块聚合；商户订单不存在或已软删除时，设备订单仍保留，`paymentInfo` 返回 `null`。
- `printParams` 是下单时保存的打印参数快照，包含文件、页数、份数、纸张、颜色和 Option 选择。
- 不返回 `deviceKey`、支付密钥或第三方凭证。
- 管理后台查询不接受客户端传入 `tenantId`、用户租户或设备凭证。
