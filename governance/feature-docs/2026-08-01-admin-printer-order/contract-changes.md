# 管理后台打印订单查询契约

## 1. 范围

- 目标仓库：`backend`、`admin`。
- 在「设备」菜单下新增「打印订单」页面。
- 查询只展示当前租户的 `device_type=printer` 设备订单；设备订单与商户订单通过 `biz_order_id = order_id` 关联。
- 复用现有设备订单分页条件与租户拦截器，不复用仅限当前 App 用户的 `/app-api/device/printer/order/list`。
- 商户订单不存在或已软删除时，仍保留设备订单记录，支付信息返回 `null`，便于后台诊断孤儿设备订单。

## 2. API

### 2.1 打印订单分页

```text
GET /admin-api/device/printer-order/page?pageNo=1&pageSize=10&bizOrderId=&taskId=&deviceCode=&status=&userId=
```

权限：`device:printer-order:query`。

响应 `data` 为 `PageResult<PrinterOrderRespVO>`：

```json
{
  "list": [
    {
      "id": 230,
      "orderNo": "2083344313370017792",
      "bizOrderId": "2083344313370017792",
      "deviceCode": "lk10gf25368889",
      "deviceType": "printer",
      "operationType": "printer_order",
      "userId": "57",
      "operationStatus": "CREATED",
      "taskId": null,
      "failureReason": null,
      "startedAt": null,
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
        "totalPrice": 0.5,
        "payPrice": 0.5,
        "paid": 1,
        "payType": "yue",
        "payTime": "2026-08-01 08:15:24",
        "status": 0,
        "refundStatus": 0,
        "refundPrice": 0,
        "shopId": 75,
        "shopName": "打印店"
      }
    }
  ],
  "total": 1
}
```

### 2.2 打印订单详情

```text
GET /admin-api/device/printer-order/get?orderNo=2083344313370017792
```

权限：`device:printer-order:query`。响应结构与分页项一致；详情允许返回 `printParams.fileKey`、`printParams.fileUrl` 和完整 `optionSelections`，不返回设备凭证 `deviceKey`。

## 3. 字段与安全规则

- 后端固定追加 `device_type=printer` 和 `deleted=0`，租户条件由 MyBatis 多租户拦截器追加。
- `paymentInfo` 来自订单模块 `OrderApi.getOrderInfo(bizOrderId)`，不在 device 模块直接访问订单表。
- 设备订单和商户订单均按当前租户隔离；跨租户的 `bizOrderId` 不得聚合返回。
- 订单不存在/软删除时不报错、不丢设备订单，`paymentInfo=null`。
- 不返回 `deviceKey`、支付密钥或第三方凭证。
