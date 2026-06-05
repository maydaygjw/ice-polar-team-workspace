# Device API Contract Changes

## Feature

Device Management — MiniApp 设备状态查询、指令下发、设备订单创建

## API Overview

> 完整接口结构（路径、参数类型、响应结构）以 OpenAPI JSON 快照为准：
> - Backend Proxy API: [`CONTRACT/backend-api.json`](../../CONTRACT/backend-api.json)
> - DMS 内部 API: [`CONTRACT/icepolar-dms-api.json`](../../CONTRACT/icepolar-dms-api.json)
>
> 架构原则、权限模式、错误码定义见 [`CONTRACTS.md`](../../CONTRACTS.md) § Device Architecture Contract

## Key Endpoints

- `GET /app-api/device/status/{imei}` — 查询设备状态
- `POST /app-api/device/command/{imei}/{commandType}` — 下发设备指令（commandType 1-11，见下方指令映射）
- `POST /app-api/device/_order` — 创建设备订单（支持优惠券）

## Device Order Creation Parameters

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imei` | String | 是 | 设备 IMEI |
| `productId` | Long | 是 | 商品 ID |
| `shopId` | Long | 否 | 店铺 ID（不传则自动从商品获取） |
| `boxFeeSelected` | Integer | 否 | 是否选择餐盒费；0=不选 1=选 |
| `couponId` | Long | 否 | 用户优惠券 ID（`yshop_coupon_user.id`） |

## Command Type Mapping (yinerda DTU Specification)

| commandType | 指令名称 | DMS 内部路径 |
|-------------|---------|-------------|
| 1 | 水桶门 | `POST /api/v1/commands/{imei}/1` |
| 2 | 杯子门 | `POST /api/v1/commands/{imei}/2` |
| 3 | 开始制冰 | `POST /api/v1/commands/{imei}/3` |
| 4 | 停止制冰 | `POST /api/v1/commands/{imei}/4` |
| 5 | 蒸发器化冰 | `POST /api/v1/commands/{imei}/5` |
| 6 | 冰桶化冰 | `POST /api/v1/commands/{imei}/6` |
| 7 | 出冰 | `POST /api/v1/commands/{imei}/7` |
| 8 | 出杯 | `POST /api/v1/commands/{imei}/8` |
| 9 | 自清洗 | `POST /api/v1/commands/{imei}/9` |
| 10 | 语音 | `POST /api/v1/commands/{imei}/10` |
| 11 | 授时 | `POST /api/v1/commands/{imei}/11` |

## DMS Forwarding

Backend 通过 `HttpClientUtils` 将请求转发至 DMS：

- **状态查询**：`HttpClientUtils.executeHttpGetRequest("/api/v1/devices/{imei}/status")`
- **指令下发**：`HttpClientUtils.executeHttpRequest("/api/v1/commands/{imei}/{commandType}", emptyMap)`
- DMS 基础地址配置项：`yshop.device.dms.host`
- Backend 负责 DMS 响应字段映射、异常包装、操作日志记录

## Contract Version

- Initial version — extracted from `CONTRACTS.md` during contract doc layering refactor
