# 管理后台设备订单契约变化

## 范围

在订单中心增加“设备订单”菜单，展示制冰机、打印机等设备产生的业务订单。设备下单统一写入订单模块，页面查询方式与外卖订单一致，并固定筛选 `orderType=device`；设备执行记录仍由设备模块内部使用，不作为业务订单列表的数据源。

## API

本功能复用订单模块既有管理后台接口，不新增订单查询接口：

- `GET /admin-api/order/store-order/page?orderType=device`
- `GET /admin-api/order/store-order/get?id={id}`

分页查询支持订单模块已有的订单号、用户电话、支付方式、订单状态和创建时间条件，并由订单模块现有租户与门店权限提供隔离。

查询权限复用 `order:store-order:query`。

## 管理菜单

- 父菜单：订单中心（`/order`）
- 菜单：设备订单（`device-order`）
- 前端组件：`mall/device/deviceOrder/index`
- 菜单权限：`order:store-order:query`

## 数据约束

- 设备订单业务状态沿用订单模块已有状态语义。
- 设备执行状态和 `extra_params` 仍属于设备订单记录，不能混入业务订单列表的查询语义。
- 不新增数据库表或字段，不修改历史订单数据。
