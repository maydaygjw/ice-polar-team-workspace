# 打印方向与单双面设置契约变化

## 商品能力同步

现有 `POST /admin-api/device/print-device/sync-options` 继续使用店铺维度同步。服务端根据已初始化设备型号重新读取 `printer_params`，将能力转换为商品 Option 分组：

```text
纸张：所选纸张
颜色：黑白、彩色
方向：设备支持的“竖向/横向”
双面：设备支持的“单面/长边双面/短边双面”
```

前端不提交链科编码作为可信数据；服务端以设备当前能力为准。

## 打印任务参数

链科 `POST /print/job` 增加可选 multipart 字段：

| 字段 | 值 |
|---|---|
| `dmOrientation` | `1` 竖向，`2` 横向 |
| `dmDuplex` | `1` 单面，`2` 长边双面，`3` 短边双面 |

## 订单快照

`DeviceOrderDO.extraParams` 增加：

```json
{
  "orientation": "横向",
  "dmOrientation": 2,
  "duplex": "长边双面",
  "dmDuplex": 2
}
```

## C 端预览

`POST /app-api/device/printer/page-count` 和 `/preview` 请求增加 `orientationName`、`duplexName`；预览图提交使用相同的链科参数。正式下单仍通过商品 `optionSelections` 传递选择。
