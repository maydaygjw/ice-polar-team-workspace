# 管理后台设备订单契约变化

## 范围

在订单中心增加“设备订单”菜单，展示制冰机、打印机等通用设备操作订单。业务订单和设备订单仍是两类记录，设备订单只通过 `biz_order_id` 关联业务订单，不改变历史业务订单状态。

## API

本功能复用既有管理后台接口，不新增或修改响应字段：

- `GET /admin-api/device/order/page`
- `GET /admin-api/device/order/get?orderNo={orderNo}`

分页查询支持 `deviceCode`、`deviceType`、`operationType`、`bizOrderId`、`status`、`userId`，并由租户拦截器提供租户隔离。

查询权限统一为 `device:order:query`，列表和详情接口均要求该权限。

## 管理菜单

- 父菜单：订单中心（`/order`）
- 菜单：设备订单（`device-order`）
- 前端组件：`mall/device/deviceOrder/index`
- 菜单权限：`device:order:query`

## 数据约束

- 设备订单状态沿用 `CREATED/QUEUED/PROCESSING/SUCCEEDED/FAILED/CANCELLED`。
- `extra_params` 作为设备类型私有快照，仅在详情中原样展示格式化内容。
- 不新增数据库表或字段，不修改历史订单数据。
