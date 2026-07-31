# 打印订单查询契约

## 1. 范围

- 目标仓库：`backend`、workspace `docs`。
- 新增打印订单专用查询接口；不修改通用 `/app-api/order/list` 和 `/app-api/order/detail/{key}`。
- 订单基础信息由订单模块提供，打印私有信息由 `yshop_device_order.extra_params` 提供。
- 仅允许当前登录用户查询自己的打印订单，并保留租户隔离。

## 2. API

### 2.1 打印订单列表

```text
GET /app-api/device/printer/order/list?page=1&limit=10&operationStatus=PROCESSING
```

请求头：`Authorization: Bearer <token>`。

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `page` | int | 否 | 页码，默认 `1` |
| `limit` | int | 否 | 每页数量，默认 `10`，最大 `100` |
| `operationStatus` | string | 否 | 设备打印状态：`CREATED`/`QUEUED`/`PROCESSING`/`SUCCEEDED`/`FAILED`/`CANCELLED` |

响应 `data` 为当前用户打印订单列表：

```json
[
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
    "operationStatus": "CREATED",
    "businessStatus": 0,
    "failureReason": null,
    "finished": false,
    "createTime": "2026-07-30 12:00:00"
  }
]
```

### 2.2 打印订单详情

```text
GET /app-api/device/printer/order/detail?orderNo=202607301200001
```

请求头：`Authorization: Bearer <token>`。

响应 `data` 在列表字段基础上增加文件、选项和任务快照：

```json
{
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
```

### 2.3 错误与支付

- 订单不存在、不是打印订单或不属于当前用户时，返回 `PRINT_ORDER_NOT_EXISTS`，不泄露其他用户订单是否存在。
- 查询接口不发起支付。支付仍调用 `POST /app-api/order/pay`，请求体使用 `{ "uni": orderNo, "from": "routine", "paytype": "weixin" }`。
- `paid=0` 时前端展示支付入口；支付完成后重新请求打印订单详情和打印进度。

## 3. 字段来源

| 响应字段 | 来源 |
|---|---|
| `orderNo`、`payPrice`、`paid`、`payTime`、`businessStatus`、`createTime` | 订单模块 `OrderApi.getOrderInfo(orderNo)` |
| `productType`、`pageCount`、`photoCount`、`copies`、`file*`、`paperName`、`colorName`、`optionSelections` | `yshop_device_order.extra_params` |
| `operationStatus`、`failureReason`、`taskId` | `yshop_device_order` |

## 4. 数据权限

- 设备订单必须是 `device_type=printer` 且未删除。
- 设备订单 `user_id` 和订单模块返回的 `uid` 均应与当前登录用户一致。
- 查询按当前租户执行，不接受客户端传入 `tenantId`、`userId` 或设备凭证。
