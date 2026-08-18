# miniapp-print-access 技术设计

关联：本目录 `contract-changes.md`；基线 `2026-07-25-printer-shop/technical-design.md`（打印主链路）、`2026-07-26-printer-order-flow`、`2026-07-27-print-job-preview`。

本期目标：打通**小程序 C 端**的打印接入——打印机发现、计价预览、打印进度、配送对接与配送进度。打印主链路（计价器、链科提交、回调状态机、`order.pay.notice`）已建，本期**不重构**，只在 C 端查询层与配送对接层增量。

## 1. 模块影响

| 模块 | 影响 |
|------|------|
| `yshop-module-device-biz-print` | ① `PrintDeliveryGateway` 占位类 → 真实实现（HTTP 直连 brick）；② 新增 `delivery/`：配送回调 Controller、配送状态服务、`BrickDeliveryGateway`；③ 新增 app 查询 Controller：`PrinterShopAppController`(发现)、`PrinterProgressAppController`(打印进度+配送进度)、`PrinterPreviewAppController`(计价预览) |
| `yshop-module-device-api` | 新增配送/进度/预览相关 DTO（跨模块只经 api）；`DeviceTypeEnum` 不变 |
| `yshop-module-mall`(order) | 复用 `OrderApi.updateOrderStatus`/`pushOrderToDelivering`/`markOrderSettled`/`autoRefundOrder`；如需"已送达"专用推进，扩展 `OrderApi`（见 D5） |
| `yshop-module-product` | 复用 `product/detail`(SKU/Option)；预览计价复用 `ProductOptionOrderApi.priceAndValidate` |
| admin | **无改动** |
| `miniapp` | **不改**：本期只冻结 C 端契约（OpenAPI），小程序后续自行对接，不在本 feature 实现 |
| `icepolar-dms` | **无改动** |

依赖方向：跨模块只经 `-api`。配送对接全部收口在 device-biz-print，不向 order/product 渗。

## 2. 关键决策

### D1 配送对接收口在 device-biz-print 新增 `delivery/` 包
brick 配送与链科打印同属"打印订单履约"外部系统，且触发点是 `PrintShopService.applyTaskState`(SUCCEEDED)。
决策：在 device-biz-print 下新增 `printer/delivery/`，含 `BrickDeliveryGateway`（发布单 HTTP 直连）、`DeliveryStatusService`（回调落库+推进）、`AppDeliveryCallbackController`。**不新建独立模块**（复用 device 租户/HTTP/日志体系，避免过度拆分——遵循架构边界品味）。
`PrintDeliveryGateway` 由"占位 @Service"改为**接口**，`BrickDeliveryGateway` 为其实现；`PrintShopService` 注入点不变（仅实现替换），保证打印主链路零改动。

### D2 出向：发布配送单（brick publishById）
`DeviceOrder` SUCCEEDED → `PrintDeliveryGateway.dispatch` → `BrickDeliveryGateway.publish`。
- 组装 `OrderVO`：`merchantUserId`=订单目的地 code、`bizRegionCode`=现有商圈号、`destinationId`=订单地址关联的目的地 ID、`orderSourceType=YXG`、`uid`=业务订单号、`sourceId`=订单日序号、`sourceIdList=[{sourceId,"YXG"}]`、`totalFee`、`clientPhone/Contact/expressAddress`、`callback_url`=配置拼接的本系统回调地址。
- **三条铁律落到代码**：`sourceIdList` 非空才发；顶层 `sourceId`=`sourceIdList[0].sourceId`；查重 key=`merchantName+orderSourceType+sourceId+uid`。
- 复用 `HttpClientUtils`，新增 `access-token` 请求头（配置 `holun.delivery.token`，仅服务端）。
- 响应 `code="200"`（字符串）为成功；解析 `data[]` 取平台 `id`/`uid` 落库到 `DeviceOrderDO.extra_params`。
- **失败处理**：发布失败不阻塞 SUCCEEDED（业务订单已 `pushOrderToDelivering`），记日志+留人工入口；配送失败与打印退款解耦。

### D3 入向：配送状态回调（幂等 + 秒回 200）
新增 `AppDeliveryCallbackController` → `POST /app-api/device/printer/delivery/callback`。
- 与链科 `AppPrintCallbackController` 同模式：try-catch 全包裹、始终返回 200、异常只记日志（brick 不重试，抛出即丢状态）。
- **先落库/入队再异步推进**：回调入口只做"解析+幂等去重+落库配送事件"，`businessStatus` 推进异步执行，避免阻塞响应。
- **幂等**：以 `platformOrderId(id) + orderState` 为去重键；重复/乱序直接返回成功不转移。
- 校验：`uid` 匹配本地配送单（`DeviceOrderDO.extra_params.deliveryUid`）；`merchantUserId` 使用订单目的地 code，并与 brick 目的地主数据一致。
- yaml 白名单新增该路径免登录（配送平台无租户上下文，靠 `uid` 校验+路径防护）。

### D4 状态映射（brick orderState → 业务 businessStatus）
与契约 §3.2 一致，终态集 `CMPL`/`CXCL_BY_MANUAL`/`CXCL_BY_SYSTEM`：

```
brick orderState        DeliveryStatus(本地)   业务 businessStatus
NEW/PACKED/ASSIGNED     DELIVERING            1 配送中(已 pushOrderToDelivering)
TAKEN                   DELIVERING            1 配送中
DLVRD/STAGED_DLVRD      DELIVERED             2 已送达/待评价  ← 推进
CMPL/STAGED_CMPL        COMPLETED(终态)        2(若用户已收货/评价则由既有逻辑推进 3)
CXCL_*终态              CANCELLED(终态)        记录配送失败,按既有退款/售后流程,不自动推进 2
```
本地配送态归一化为 `PENDING/DELIVERING/DELIVERED/COMPLETED/CANCELLED`，供 C 端进度查询。

### D5 业务订单"已送达"推进
现状 `OrderApi` 有 `pushOrderToDelivering`(1)、`markOrderSettled`、通用 `updateOrderStatus(orderId,status)`，无专用"已送达(2)"。
决策：配送回调到 `DLVRD`/`CMPL` 时，经 `OrderApi.updateOrderStatus(bizOrderId, 2)` 推进；**不新增 OrderApi 方法**（通用方法已够，避免 api 膨胀）。
边界：仅当订单 `orderType=device` 且当前 `businessStatus=1` 时推进到 2；评价/收货推进到 3 由既有 `order/take`、`order/reply` 路径负责，本期不改。

### D6 C 端查询层（发现 / 预览 / 进度）
- **发现** `GET /app-api/printer/shop/nearby|detail`：复用店铺派生查询，过滤"店铺下存在 `deviceType=printer` 且已初始化（有 `device_key`）的设备"；不回显 `deviceKey`。纸张/颜色能力读初始化生成的 Option。
- **页数与计价** `POST /app-api/device/printer/page-count`：复用 `PrintJobPreviewService` 的计算段（`PrinterGateway.getFilePages` + `PrintSpecResolver` + `ProductOptionOrderApi.priceAndValidate`），只取页数和价格，不提交预览图任务。
- **文件预览图** `POST /app-api/device/printer/preview` + `GET /app-api/device/printer/preview-result`：复用 admin 的 `isPreview=1` 提交/轮询链路，返回 `taskId` 和每页 `previewImages`，不真实打印、不落库。
- **打印进度** `GET /app-api/device/printer/progress?orderNo=`：读 `DeviceOrderDO`(`status`+`failureReason`)+业务订单 `businessStatus` 聚合返回；前端轮询至终态。
- **配送进度** `GET /app-api/order/delivery/progress?orderNo=`：读 `DeviceOrderDO.extra_params` 配送快照+配送事件时间线（骑手信息+归一化状态序列）。

## 3. 核心流程

### 打印 → 配送 → C 端进度
```
打印完成: PrintShopService.applyTaskState(SUCCEEDED)
  → orderApi.pushOrderToDelivering(bizOrderId)      [业务 1 配送中]
  → PrintDeliveryGateway.dispatch (BrickDeliveryGateway.publish)
      → 组 OrderVO(YXG, uid=orderNo, sourceId=sourceIdList[0]) → brick publishById
      → 成功: 平台 id/uid 落 DeviceOrderDO.extra_params.delivery{OrderId,Uid,Status=PENDING}
      → 失败: 记日志+人工入口,不阻塞
brick 状态回调 POST /app-api/device/printer/delivery/callback
  → 解析 OrderVO → 校验 uid → 幂等去重(id+orderState) → 落配送事件
  → 异步推进 DeliveryStatus + businessStatus
      DLVRD/CMPL → OrderApi.updateOrderStatus(bizOrderId, 2)   [业务 2 已送达]
      CXCL_*     → 记配送失败,走既有退款/售后
C 端轮询:
  GET /app-api/device/printer/progress?orderNo=   → DeviceOrder.status + businessStatus
  GET /app-api/order/delivery/progress?orderNo=   → DeliveryStatus + 骑手 + 事件时间线
用户评价/收货: order/take、order/reply(既有) → businessStatus 3
```

## 4. 迁移 / 回滚

新增 `sql/upgrade-2026-07-28-miniapp-print-access.sql`（含回滚）。
- `yshop_device_order`：**不新增列**，配送快照存 `extra_params` JSON：
  `deliveryOrderId`、`deliveryUid`、`deliveryStatus`、`riderName`、`riderMobile`、`destinationId`、`bizRegionCode`、`deliveryEvents[]`(状态+时间，幂等去重兼时间线)。
  > 事件量小（单订单 ≤ ~8 条），先存 `extra_params.deliveryEvents`；若后续需独立查询/轨迹再抽事件表。
- 白名单：`application.yaml` 新增 `/app-api/device/printer/delivery/callback` 免登录（随代码，非 SQL）。
- 不改店铺表（bizRegionCode 用现有商圈；merchantUserId/destinationId 用订单关联目的地）；不新增表/列/唯一约束；不动 ICE_MAKER 路径。

## 5. 风险

| 风险 | 缓解 |
|------|------|
| brick 对 YXG 未放开 HTTP 回调 | 契约 §3.2 前置约定；联调前与 brick 确认，未放开则降级主动查单（备选已留） |
| 配送回调丢失（brick 不重试） | 回调秒回 200+全 try-catch；留 admin 手动 sync 补偿入口 |
| 配送回调伪造（无签名） | `uid` 匹配本地配送单 + `merchantUserId` 校验 + `id+orderState` 幂等 + 状态只前进 |
| 重复发单 | 顶层 `sourceId`=`sourceIdList[0].sourceId`；查重 key 对齐 brick；发布前查 `extra_params.deliveryUid` 已存在则跳过 |
| `sourceIdList` 为空误发 0 单仍 success | 代码强制非空断言，空则视为发布失败 |
| 配送发布失败但订单已 1 配送中 | 配送与打印退款解耦；失败记日志+人工，不自动退款 |
| 签名 URL/文件时效 | 沿用基线 D3（≥10min)，本期不变 |
| 平台 token 泄露 | 仅服务端配置 `holun.delivery.token`，不入库/日志/前端 |

## 6. 契约变化

详见本目录 `contract-changes.md`。
