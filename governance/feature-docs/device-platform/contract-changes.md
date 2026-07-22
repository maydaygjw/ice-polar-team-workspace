# 契约变更 — 通用设备平台与制冰机迁移

## Module Contracts

| 模块 | 对外职责 | 允许依赖 |
|------|----------|----------|
| `device-core-api` | 设备规范、状态、通用设备订单 DTO | `yshop-common` |
| `device-ice-api` | 制冰机能力 DTO 和兼容接口 | `device-core-api` |
| `device-core-biz` | 设备基础模型、订单和状态实现 | `device-core-api` |
| `device-ice-biz` | 制冰机能力和 DMS/MQTT 实现 | `device-ice-api`、`device-core-api` |
| `device-api/biz` | 迁移期旧接口兼容外观 | `device-core-api`、`device-ice-api` |

新模块之间禁止直接依赖对方 `-biz`。

## Existing API Compatibility

以下接口已存在，本期保持路径和业务语义兼容：

| 端点 | 当前用途 | 迁移策略 |
|------|----------|----------|
| `/admin-api/device/device-management/_connect` | 连接制冰机 | 转换为 `device-ice` 能力调用 |
| `/admin-api/device/device-management/_disConnect` | 断开制冰机 | 转换为 `device-ice` 能力调用 |
| `/admin-api/device/device-management/_order` | 创建制冰机设备订单 | 转换为通用设备订单 + 制冰机扩展 |
| `/admin-api/device/device-management/_queryDeviceOrder` | 查询制冰机设备订单 | 统一查询兼容视图 |
| `/admin-api/device/order/page` | 分页查询通用设备订单 | 新管理端查询接口，使用 `deviceCode`、`deviceType`、`operationType`、`bizOrderId`、`status` 等通用字段 |
| `/admin-api/device/order/get` | 查询通用设备订单详情 | 新管理端查询接口，按通用设备订单号查询 |
| `/app-api/device/status/{imei}` | 查询制冰机状态 | 保留旧 `imei` 入参，内部使用 `deviceCode` |
| `/app-api/device/command/{imei}/{commandType}` | 下发制冰机命令 | 命令映射移入 `device-ice` |
| `/app-api/device/_order` | 小程序创建制冰机订单 | 保持原有请求和结果语义 |

本期不新增设备绑定/解绑接口，也不把设备归属关系抽象为独立 API。

## Internal API

`device-core-api` 至少提供：

| 接口 | 入参 | 结果 |
|------|------|------|
| `DeviceCoreApi.getDevice(deviceCode)` | 通用设备号 | 设备摘要和状态 |
| `DeviceCoreApi.queryDeviceState(deviceCode)` | 通用设备号 | 连接状态、可用状态和最近通信时间 |
| `DeviceOrderApi.create(request)` | 设备号、类型、操作类型、业务关联号 | 通用设备订单 |
| `DeviceOrderApi.get(orderId)` | 通用设备订单号 | 订单当前状态和执行结果 |
| `DeviceOrderApi.finish(orderId, result)` | 订单号、执行结果 | 更新订单完成/失败状态 |

`device-ice-api` 至少提供：

| 接口 | 说明 |
|------|------|
| `IceDeviceApi.getStatus(imei)` | 兼容制冰机状态查询 |
| `IceDeviceApi.sendCommand(imei, commandType)` | 兼容制冰机命令下发 |
| `IceDeviceApi.createOrder(request)` | 创建制冰机能力订单 |

## DTO and Status

通用设备摘要至少包含：`deviceCode`、`deviceType`、`tenantId`、`connectionStatus`、`availabilityStatus` 和 `lastHeartbeatAt`。

- `connectionStatus`：`ONLINE`、`OFFLINE`、`UNKNOWN`。
- `availabilityStatus`：`IDLE`、`OCCUPIED`、`MAINTENANCE`、`DISABLED`。

通用设备订单至少包含：`deviceOrderId`、`deviceCode`、`deviceType`、`bizOrderId`（可空）、`operationType`、`status`、`requestedAt`、`startedAt`、`finishedAt` 和 `failureReason`。

通用订单状态：`CREATED`、`QUEUED`、`RUNNING`、`SUCCEEDED`、`FAILED`、`CANCELLED`。

## Database

拟使用迁移脚本：`backend/sql/upgrade-2026-07-22-device-platform.sql`。

### `yshop_device`

在保留历史 `imei` 的前提下，增加或规范化：

| 字段 | 类型 | 说明 |
|------|------|------|
| `device_type` | VARCHAR(32) | 设备类型，如 `ice_maker` |
| `device_code` | VARCHAR(128) | 通用设备号 |
| `connection_status` | VARCHAR(32) | 在线、离线、未知 |
| `availability_status` | VARCHAR(32) | 空闲、占用、维护、停用 |
| `metadata` | JSON/TEXT | 非业务专属的扩展元数据 |

所有查询继续带 `tenant_id`；不新增独立绑定表。

### `yshop_device_order`

保留现有订单号、`imei`、用户和时间字段，增加或规范化：

`device_type`、`device_code`、`biz_order_id`、`operation_type`、`status`、`started_at`、`finished_at`、`failure_reason`。

- `biz_order_id` 使用 `String(32)`，只建立业务关联。
- 旧 `order_no` 和新 `device_order_id` 必须建立唯一映射。
- 所有记录含 `tenant_id` 并按租户查询。

### Rollback

停止新 core/ice 实现后切回旧 device 服务；新增字段暂不删除，避免破坏历史数据。后续物理删除必须另建带回滚语句的升级脚本。

## Permissions

- 继续使用现有管理端和小程序鉴权方式。
- 设备和设备订单查询必须满足租户隔离及已有门店/部门数据权限。
- DMS 只接受 backend 设备模块调用，小程序不新增直连路径。

## External System

本期不新增外部系统契约。DMS/MQTT 的现有路径、认证和响应映射保持不变，由 `device-ice-biz` 的适配器承接。
