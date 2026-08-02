# 打印 C 端接入（miniapp-print-access）契约变化

> 只列变化项。前置已建能力见 `2026-07-24-device-api`、`2026-07-25-printer-shop`、`2026-07-26-printer-order-flow`、`2026-07-27-print-job-preview`。
> 配送平台（霍伦 brick）字段行为以本文 §3 为准（源自 `brick` order-service / push-service 源码）。

## 1. Feature 范围

- 目标仓库：`backend`、`miniapp`。不改 `admin`、`icepolar-dms`。
- 复用：通用订单闭环（pay/refund/take/reply）、商品 SKU/Option、链科打印、`order.pay.notice`。
- 新增聚焦三类 C 端缺口：**打印机发现**、**打印进度**、**配送对接与配送进度**。

## 2. Backend API（app-api 新增）

### 2.1 打印机发现（功能1）

```text
GET /app-api/printer/shop/nearby?latitude=&longitude=&keyword=
```

返回可打印门店列表。复用 `store/nearby` 派生逻辑，**过滤条件：店铺下存在 `deviceType=printer` 且初始化完成的设备**。

响应元素（在店铺基础上扩展）：

| 字段 | 说明 |
|---|---|
| `shopId` / `shopName` / `address` / `distance` / `latitude` / `longitude` | 店铺定位与距离 |
| `printerOnline` | 设备是否在线（链科 `printer_status` 或最近心跳） |
| `paperNames` | 可选纸张（来自初始化生成的纸张 Option） |
| `colorNames` | 可选颜色 |

```text
GET /app-api/printer/shop/detail?shopId=
```

返回打印店详情：上述能力 + 设备型号（展示用，`device_model`）+ 是否可下单。**不回显 `deviceKey`**。

### 2.2 获取文件页数与计价（功能2 C 端）

```text
POST /app-api/device/printer/page-count
```

请求：`shopId, fileUrl, fileExt, paperName, colorName, copies`（与 admin preview 同口径）。
响应：`pageCount, basePrice, optionDelta, unitPrice, copies, totalPrice`。

> 仅调用 `PrinterGateway.getFilePages` 获取页数并完成计价，不提交链科预览图任务。
> 纸张/颜色**不进 SKU**，走 Option；SKU 基础规格用既有 `product/detail`。

### 2.3 文件预览图（功能3 C 端）

提交预览任务：

```text
POST /app-api/device/printer/preview
```

请求：`shopId, fileUrl, fileExt, paperName, colorName, copies`。
响应：计价字段 + `taskId`。该任务调用链科 `POST /print/job` 并传 `isPreview=1`，只生成预览图，不真实打印、不落库。

轮询预览图：

```text
GET /app-api/device/printer/preview-result?shopId=&taskId=
```

响应：`taskState, finished, previewImages[], taskTicket, resultCode, resultMsg`。
`previewImages` 为每页带时效签名的图片 URL，仅在链科任务成功后返回。

### 2.4 实时打印进度（功能4）

```text
GET /app-api/device/printer/progress?orderNo=
```

| 出参 | 说明 |
|---|---|
| `operationStatus` | DeviceOrder 状态：CREATED/QUEUED/PROCESSING/SUCCEEDED/FAILED/CANCELLED |
| `taskState` | 链科任务态：READY/PARSING/SENDING/SUCCESS/FAILURE/REVOKED（透传，可为空） |
| `businessStatus` | 业务订单主状态：0 待制作 / 1 配送中 / 2 已送达 / 3 已完成 |
| `failureReason` | 失败原因（`task_result.code/msg`） |
| `finished` | 是否终态（SUCCEEDED/FAILED/CANCELLED） |

前端**轮询**至 `finished=true`（沿用 preview-result 思路）。状态推进以链科回调为准，超时由 backend 主动 `GET /print/job` 补偿。WebSocket/订阅消息推送为后续增强，不在本期。

## 3. 外部系统：配送平台（霍伦 brick，功能6）

> 本期将 `PrintDeliveryGateway` 从占位改为真实实现。Base URL 走配置（示例 `https://rdev.holuntech.com`），token 走配置项 `holun.token`（仅服务端，禁止入库/提交）。

### 3.1 出向：发布配送订单

```text
POST {delivery.host}/order/order/publishById
Header: access-token: {holun.token}
Content-Type: application/json
```

backend 组装 `OrderVO`，映射规则：

| OrderVO 字段 | 来源 | 备注 |
|---|---|---|
| `merchantUserId` | **yshop 店铺 id**(`StoreShopDO.id`) | 不写死；发布单时按 deviceCode(=shopCode）查店铺实时取。与 brick 商家主数据 id 已打通一致 |
| `bizRegionCode` | **店铺商圈 id**(`StoreShopDO.businessRegionId`) | 不写死；yshop 无独立 regionCode 字段，用商圈主键，与 brick RegionVO id 已打通一致 |
| `destinationId` | **下单人收货地址 id**(`StoreOrderDO.addressId` → `UserAddressDO.id`) | 不写死；与 brick DestinationVO id 已打通一致 |
| `destinationId` | 用户收货楼宇 | 必须能查 DestinationVO |
| `totalFee` | 业务订单金额 | |
| `clientPhone` / `clientContact` / `expressAddress` | 订单收货信息 | |
| `sourceId` | 订单日序号 | **必须与 `sourceIdList[0].sourceId` 一致**（查重 key 用顶层值） |
| `uid` | 订单唯一标识（orderNo 或条码） | 参与查重 key |
| `orderSourceType` | **`YXG`** | 打印件配送固定来源类型 |
| `sourceIdList` | `[{sourceId, orderSourceType:"YXG"}]` | **发单入口，空则一单不发且仍返回 success** |
| `callback_url` | 配置拼接的本系统回调地址（见 §3.2） | **要求 brick 对 YXG 走 HTTP 回调**（见 §3.2 前置约定） |
| `deliverToRoom` / `delayTime` / `expressTime` / `memo` | 订单配置/备注 | 可选 |

触发时机：`DeviceOrder` → `SUCCEEDED`（打印完成），经 `PrintDeliveryGateway` 调用。
关键坑点（必须遵守）：`sourceIdList` 非空才发单；顶层 `sourceId` 与 `sourceIdList[0].sourceId` 一致；`quantity`/`orderState` 服务端覆盖（发几单由 `sourceIdList` 长度决定）；查重 key=`merchantName+orderSourceType+sourceId+uid`。

响应：`code="200"`（字符串）为成功；`data[]` 每元素对应一单。需将配送平台 `id`/`uid` 落库（见 §4）。

### 3.2 入向：配送状态回调（HTTP）

**前置约定**：YXG 类型默认走 redis channel，本期经与 brick 团队确认**对 YXG 启用 HTTP 回调**——发单传 `callback_url`，平台每次状态变更 POST 整个 OrderVO 到该地址。若 brick 侧实际未放开 YXG 的 HTTP 回调，本方案降级为主动查单（见 §3.2 备选）。

```text
POST /app-api/device/printer/delivery/callback
```

- 平台每次状态变更 POST OrderVO 到 `callback_url`；**先落库/入队再异步处理，接口快速返回 200**（平台只读响应字符串、不重试，异常冒出会丢状态）。
- 校验：`uid`/`id` 匹配本地配送单；按 `id + orderState` **幂等去重**（同一订单多条回调）。
- 请求体字段（OrderVO 关键子集）：`id`、`uid`、`merchantUserId`、`orderState`、`riderUserId`、`riderRealName`、`riderMobile`、`assignedTime`、`endTime`、`alreadyTaken`、`sourceId`、`orderSourceType`。
- yaml 白名单：新增该路径免登录（与链科 `printer/callback` 同模式），靠 `uid` 校验+路径防护，不进租户拦截器（配送平台无租户上下文）。

> 备选（brick 未放开 YXG 回调时）：新增"按 `uid` 主动查配送单状态"接口，前端轮询我端、我端轮询 brick，不依赖回调。

状态 → 业务订单 `businessStatus` 映射（终态集 `CMPL`/`CXCL_BY_MANUAL`/`CXCL_BY_SYSTEM`）：

| orderState | 含义 | 业务推进 |
|---|---|---|
| `NEW`/`PACKED`/`ASSIGNED` | 待打包/打包完成/已派单 | 保持 `businessStatus=1`（配送中） |
| `TAKEN` | 骑手已收单（取货） | `1` 配送中 |
| `DLVRD` / `STAGED_DLVRD` | 已送达 | **`businessStatus=2`**（已送达/待评价） |
| `CMPL` / `STAGED_CMPL` | 完成（终态） | `2`（若用户已确认收货/评价则由既有逻辑推进 3） |
| `CXCL_*`（终态取消） | 取消 | 记录配送失败，按既有退款/售后流程处理，不自动推进 2 |

| orderState | 含义 | 业务推进 |
|---|---|---|
| `NEW`/`PACKED`/`ASSIGNED` | 待打包/打包完成/已派单 | 保持 `businessStatus=1`（配送中） |
| `TAKEN` | 骑手已收单（取货） | `1` 配送中 |
| `DLVRD` / `STAGED_DLVRD` | 已送达 | **`businessStatus=2`**（已送达/待评价） |
| `CMPL` / `STAGED_CMPL` | 完成（终态） | `2`（若用户已确认收货/评价则由既有逻辑推进 3） |
| `CXCL_*`（终态取消） | 取消 | 记录配送失败，按既有退款/售后流程处理，不自动推进 2 |

### 3.3 C 端配送进度查询

```text
GET /app-api/order/delivery/progress?orderNo=
```

| 出参 | 说明 |
|---|---|
| `deliveryStatus` | 本地归一化配送态（待发单/配送中/已送达/已取消） |
| `riderRealName` / `riderMobile` | 骑手信息（ASSIGNED 后有值） |
| `platformOrderId` / `uid` | 配送平台订单标识 |
| `events[]` | 归一化状态时间线（state + time，供前端展示轨迹） |

> 实时进度来源 = 已落库的配送回调事件；不提供骑手 GPS 坐标（OrderVO 回调无位置字段）。前端轮询或随订单详情一并返回。

## 4. DB

新增 `sql/upgrade-2026-07-28-miniapp-print-access.sql`（含回滚）。

- `yshop_device_order`：`extra_params` JSON 扩展（不新增列），存放配送快照：
  `deliveryOrderId`(平台 id)、`deliveryUid`、`deliveryStatus`、`riderName`、`riderMobile`、`destinationId`、`bizRegionCode`、`deliveryEvents[]`(幂等去重键+状态时间线，或独立事件表，实现时二选一)。
- `merchantUserId`/`bizRegionCode`/`destinationId`：发布单时从店铺/订单实时取（店铺 id、businessRegionId、收货地址 id），**不配置、不写死**。已确认这三个 yshop 主键与 brick 侧主数据 id 打通一致。
- 均含租户/审计字段；不破坏存量列；不新增唯一约束。

## 5. MQ / 状态推送

- 打印触发配送：复用现有 `DeviceOrder` 状态推进，`SUCCEEDED` 时同步调用 `PrintDeliveryGateway`（不在 `order.pay.notice` 之外新增支付事件）。
- 配送状态回调：回调入口（`/app-api/device/printer/delivery/callback`）落库后投递本地事件异步推进 `businessStatus`，避免阻塞回调响应。复用现有 stream 机制，不新增中间件。

## 6. 权限 / 数据范围

- 新 app-api 走 C 端登录 + 租户上下文；`productId`/`shopId`/`orderNo` 必须属当前用户/租户。
- 配送回调端点免登录但靠 `uid` 校验+路径防护，不进租户拦截器（配送平台无租户上下文）。
- 客户端不得提交 `deviceKey`、`merchantUserId`、最终价格、页数、平台 token 作为可信值。

## 7. 依赖

- 复用 `HttpClientUtils` 直连配送平台（无 Java SDK，HTTP 直连）；无新增 Maven 依赖。
- 前端无新增框架依赖。

## 8. ADR

- 拟新增 ADR：`打印订单配送对接（霍伦 brick publishById + YXG HTTP 回调）`，记录 sourceIdList 发单、查重 key、YXG 启用 HTTP 回调、状态映射与幂等决策。
