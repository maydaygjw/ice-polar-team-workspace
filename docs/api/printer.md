# 打印接口（App 端）

> 前端对接文档。所有接口统一返回 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功，非 0 时 `msg` 为错误文案，直接 toast 即可。
>
> 登录要求逐接口标注；需登录的请求头：`Authorization: Bearer <token>`。
>
> 源码：`backend/yshop-module-device/yshop-module-device-biz-print/.../controller/app/`
>
> **整体流程**：附近门店 → 门店详情（拿纸张/颜色能力）→ **上传文件拿 fileUrl** → 计价预览 → 创建订单 → 查询打印订单列表/详情 → 走现有订单支付接口付款 → 轮询打印进度 →（如配送）轮询配送进度。支付成功后由后端自动提交打印任务给链科云打印。

| 方法 | 路径 | 说明 | 需要登录 |
|------|------|------|:---:|
| POST | `/app-api/infra/file/upload` | 上传文件（拿 fileUrl） | ❌ |
| GET | `/app-api/device/printer/shop/nearby` | 附近可打印门店列表 | ❌ |
| GET | `/app-api/device/printer/shop/detail` | 打印店详情（纸张/颜色能力） | ❌ |
| POST | `/app-api/device/printer/preview` | 打印计价预览（不真实打印） | ❌ |
| POST | `/app-api/device/printer/order` | 创建打印订单 | ✅ |
| GET | `/app-api/device/printer/order/list` | 打印订单列表（含打印特殊信息） | ✅ |
| GET | `/app-api/device/printer/order/detail` | 打印订单详情（含文件/选项/任务信息） | ✅ |
| GET | `/app-api/device/printer/progress` | 打印进度（前端轮询） | ✅ |
| GET | `/app-api/device/printer/delivery/progress` | 配送进度（前端轮询） | ✅ |
| POST | `/app-api/device/printer/callback` | 链科打印任务状态回调（**外部系统用，前端不调**） | ❌ |

---

## 1. 上传文件 `POST /app-api/infra/file/upload`

无需登录。preview / order 需要的 `fileUrl` 都从这里拿。multipart 表单上传。

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

## 4. 打印计价预览 `POST /app-api/device/printer/preview`

无需登录。文件打印专用：解析文件实际页数并按「(SKU 基础价 + Option 加价) × 页数 × 份数」计价，不产生订单、不真实打印。

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

---

## 5. 创建打印订单 `POST /app-api/device/printer/order`

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

## 6. 打印订单列表 `GET /app-api/device/printer/order/list`

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

---

## 7. 打印订单详情 `GET /app-api/device/printer/order/detail`

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

---

## 8. 打印进度 `GET /app-api/device/printer/progress`

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

## 9. 配送进度 `GET /app-api/device/printer/delivery/progress`

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

## 10. 打印回调 `POST /app-api/device/printer/callback`

**链科云平台调用，前端不要调。** 无登录、无签名，后端靠 device_id / task_id / 状态机三重校验防伪造；始终返回成功避免链科重投。

---

## 对接提示

- **下单前**：先 `shop/detail` 确认 `canOrder=true`，文件打印先 `preview` 展示页数和价格。
- **查询**：订单列表使用 `order/list`，详情使用 `order/detail?orderNo=`；普通订单接口不会返回打印文件、纸张、颜色、页数等扩展信息。
- **支付**：`order` 返回 `orderNo` 后调现有订单支付接口；未支付不会进入打印队列。
- **支付状态**：使用打印订单列表/详情返回的 `paid` 判断是否展示支付按钮；支付后重新查询详情确认 `paid=1`。
- **轮询**：`progress` 的 `finished=true` 即停止；`FAILED` 时展示 `failureReason`。
- **幂等**：下单重试、网络超时重发必须用同一个 `requestId`，后端按幂等键去重。
- 本地启动后端后可在线查看 API 文档：`http://localhost:8888/doc.html`。
