# BACKLOG-008 打印店（第三方云打印平台对接）

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-008 |
| Title | 打印店（第三方云打印平台对接） |
| Status | `draft` |
| Priority | `P2` |
| Created | 2026-07-25 |
| Author | gejunwen |
| Tags | device, printer, shop, third-party, callback |

## Problem / Need

当前系统仅有制冰机一种设备类型和业态。需要引入第三方云打印平台（链科云打印），新增打印机设备类型和打印店业态，让用户可以在小程序上找到打印店、选择打印机、上传文件并完成打印。

范围约束：**一个打印店 = 一个云盒(deviceId) = 一台打印机**。本期只做后端 + 管理后台，小程序与 DMS 暂不涉及。

核心场景：
- 用户扫描打印店二维码 → 进入打印店 → 选择打印机（商品）→ 设置打印规格 → 上传文件 → 支付 → 后台自动提交打印任务 → 打印完成通知用户；打印失败自动退款。

## Context

### 云打印平台（链科云打印 v3）

> 完整接口字段已整理到本地：`governance/KNOWLEDGE/lianke-cloud-print-api.md`（源自官方 SDK 源码，官方文档站为 JS 渲染无法直接抓取）。

- API 地址：`cloud.liankenet.com`
- 认证：Header `ApiKey`
- 设备凭证：`deviceId` + `deviceKey`（从二维码 base64 解析）
- 核心 API：
  - `GET /api/external_api/printer_list` — 获取云盒下所有打印机
  - `GET /api/print/printer_params` — 获取打印机能力参数
  - `POST /api/print/job` — 提交打印任务（form-data，异步返回 task_id）
  - `GET /api/print/job` — 查询任务状态
  - `DELETE /api/print/job` — 取消任务
  - `GET /api/device/device_info` — 设备状态
- 任务状态：READY → PARSING → SENDING → SUCCESS/FAILURE，SET_REVOKE → REVOKED
- 回调：POST JSON 到 callbackUrl，携带 device_id, task_id, task_state, task_result

### 现有系统现状（已核对代码）

- `DeviceTypeEnum` 目前仅 `ICE_MAKER("ice_maker","制冰机")`，位于 `yshop-module-device-api/.../enums/DeviceTypeEnum.java`，注释明确"类型专属能力放在对应能力模块"，加 `PRINTER` 是预期扩展点。
- 设备模块拆分 `yshop-module-device-api`（枚举/DTO/`DeviceCoreApi`）与 `yshop-module-device-biz`（实现）。跨模块只暴露 `DeviceCoreApi`（getDeviceByCode / createOperationOrder / getOperationOrder）。
- 网关模式：`IceDeviceGateway` 接口 + `DmsIceDeviceGateway` 实现（HTTP 调 DMS），位于 `device/ice/api` + `device/ice/service`。**目前无通用 `DeviceGateway` 接口，也无按类型分发的注册表**——`DeviceManagementServiceImpl` 直接字段注入 `iceDeviceGateway` 并硬编码 `ICE_MAKER`。
- `yshop_device`(`DeviceManagementDO`) / `yshop_device_order`(`DeviceOrderDO`) 已有 `deviceType` 字符串列。`DeviceOrderDO.status` 用 `DeviceOperationOrderStatusEnum`（CREATED/QUEUED/PROCESSING/SUCCEEDED/FAILED/CANCELLED）。
- `device_code = shop_code` 是**运行时惰性查找**，非 DB/类级约束：`DeviceManagementServiceImpl.queryDeviceAndShopInfo(imei)` → `storeShopService.getShopByShopCode(imei)`，列是 `yshop_store_shop.shop_code`。PRINTER 设备要被发现，需 `device_code` 等于目标店 `shop_code`。
- 支付成功走 MQ：`PayNoticeProducer`（stream `order.pay.notice`）→ `PayNoticeConsumer` → `AppStoreOrderServiceImpl.paySuccess(...)`。**这是支付后提交打印任务的挂载点**。注意：制冰机目前是"手动触发"——支付成功只改订单状态，真正的设备动作由小程序另调 `POST /app-api/device/_initiateDirect`；打印机需决定沿用此模式还是在 `paySuccess` 内自动触发。
- 回调入口：现有外部回调只有支付渠道回调 `POST /app-api/order/notify/payBack{detailsId}.json`。DMS 网关是**纯轮询出向**，无入向 webhook。打印需新增入向 controller（如 `/app-api/device/printer/callback`）+ 在 `application.yaml` 加白名单。
- 路由前缀自动挂载：`controller/app/**`→`/app-api`，`controller/admin/**`→`/admin-api`（`WebProperties`）。
- SKU：`StoreProductAttrValueDO`（`yshop_store_product_attr_value`），`sku` 为 `attr_value|attr_value...` 有序拼接，价格/库存/图按 SKU 维度。打印规格可复用，但 `ProductApi` 未暴露 SKU 查询，跨模块用需扩展。
- 建表/改表：写 `sql/upgrade-YYYY-MM-DD-printer-shop.sql`，禁止改 `sql/yixiang-drink.sql`。

### 模型映射关系

**范围约束：一个打印店 = 一个云盒(deviceId) = 一台打印机。** 不支持一店多打印机。

```
云打印平台              →  系统内
云盒(deviceId)          →  打印店 (shop_code = deviceId) 且 = 设备 (device_code = deviceId)
打印机                  →  商品 (Product)（一店仅一台，商品即该打印机）
打印机能力参数           →  商品规格 (ProductAttr/AttrValue)
提交打印任务             →  支付后动作
打印任务状态(task_state) →  设备订单状态 (DeviceOrder.status)
callbackUrl             →  后端回调端点 /app-api/device/printer/callback
```

> deviceId 同时作为 `shop_code`（店铺）与 `device_code`（设备），复用现有 `device_code = shop_code` 惰性约定。

### 三层状态映射

业务订单主状态以 `StoreOrderDO.status`（`订单模块设计.md` §6.3）为准，退款走独立 `refund_status`（§6.4）。

```
业务订单 status       业务 paid/refund   设备订单 DeviceOrder.status   云任务 task_state
0 待发货/待制作        paid=0            CREATED                      -
0 待发货/待制作        paid=1            QUEUED                       READY
0 待发货/待制作        paid=1            PROCESSING                   PARSING/SENDING
1 待收货(打印完成)     paid=1            SUCCEEDED                    SUCCESS
3 已完成(用户确认)     paid=1            -                            -
-  (触发自动退款)      refund_status=1→2 FAILED                       FAILURE
-2 已退款             refund_status=2   CANCELLED                    REVOKED
```

要点：
- 业务主状态只用 `0 / 1 / 3`（待制作→待收货→已完成），不引入 `2 待评价`（设备订单无评价环节）。
- 打印失败（FAILURE）→ 自动退款：`refund_status` 0→1→2，主状态最终 `-2 已退款`。
- `task_state` 的 `code/msg`（如 `503 设备连接异常`）记入 `DeviceOrderDO.failureReason`。

### 涉及仓库

| 仓库 | 变更范围 |
|------|---------|
| `backend` (yshop-drink) | `DeviceTypeEnum` 加 `PRINTER`；新增 `device/printer/api/PrinterGateway` + `device/printer/service/LiankePrinterGateway`（仿 `IceDeviceGateway`/`DmsIceDeviceGateway`）；引入按类型分发（通用 `DeviceGateway` + 注册表，或在 `DeviceManagementServiceImpl` 分支）替换硬编码 ICE_MAKER；新增打印回调 controller + yaml 白名单；扩展 `DeviceCoreApi` 或新增打印 Service/Controller |
| `admin` (yshop-drink-vue) | 新增打印店管理、打印机管理、打印任务管理页面 |
| `miniapp` (icepolarminiapp) | **暂不涉及** |
| `icepolar-dms` | **暂不涉及**（打印机不经过 DMS，后端直连链科云） |

### 已确认问题

1. **回调无认证机制**。回调体：
   ```json
   {"device_id":"lk112312312312","task_id":"bd85931c-...","task_state":"SUCCESS","create_time":"...","finish_time":"...","task_result":{"code":503,"msg":"设备连接异常，请检查设备网络"}}
   ```
   因无签名，回调端点必须自行校验：`device_id` 存在于本地设备表、`task_id` 与本地 `DeviceOrderDO` 匹配、状态转移合法（只允许前进不允许回退），三者任一不满足即丢弃。`task_result.code/msg` 记入 `failureReason`。
2. **文件上传**：小程序上传到后端 OSS，后端用文件 URL + `urlFileExt` 提交打印任务。✅
3. **打印失败**：自动退款（无需人工审核）。✅
4. **云盒/打印机拓扑**：暂不考虑一云盒多打印机。一个店铺只能有 1 个云盒，每个云盒对应 1 个打印机（设备 id）。✅

### 待定问题

1. 定价模型细节：按页？按纸张/颜色？建议初期按商品固定价格 + 规格加价（复用 SKU 价格模型）。

### 关键设计决策（代码分析得出）

- **触发模式**：制冰机是"手动触发"（支付成功只改订单，小程序再调 `_initiateDirect` 启动设备）。打印机采用**自动触发**——在 `AppStoreOrderServiceImpl.paySuccess` 内（或新增监听 `order.pay.notice` 的 consumer，用新 `bizType` 隔离）按 `orderType=device` + `deviceType=printer` 提交打印任务，贴合无人值守打印店。
- **网关分发**：现在 `DeviceManagementServiceImpl` 硬编码 ICE_MAKER。加 PRINTER 时应顺势抽通用 `DeviceGateway` 接口 + 按 `DeviceTypeEnum` 的注册表，避免 if/else 蔓延。`DeviceCoreApiImpl.parseDeviceType` 已能自动识别新枚举值，无需改。
- **回调真实性**：链科回调是系统内**首个入向设备状态 webhook**（DMS 仅轮询），且**无签名**。新增 `/app-api/device/printer/callback` controller + yaml 白名单 + 幂等（同一 task_id 重复回调），靠 device_id/task_id/状态机合法性三重校验防伪造。状态推进以本地 `DeviceOrderDO` 为准，回调只触发合法前进转移。
- **店铺关联**：沿用 `device_code = shop_code` 惰性约定。一店一盒一打印机，`deviceId` 同时作 `shop_code` 与 `device_code`；设备入网时校验该值等于目标 `shop_code`，避免"查得到设备查不到店"。
- **失败退款**：打印 FAILURE → 自动退款，复用订单退款流程，将 `refund_status` 推进 0→1→2，主状态最终 -2。需处理"已 SUCCEEDED 后收到 REVOKED"等竞态，状态机只允许前进。

### 风险

- **状态机三方对齐**：业务订单/设备订单/云任务三层状态非一一对应（如 FAILURE 但用户已付款 → 退款；REVOKED 但已 SUCCEEDED 的竞态）。需明确每个云状态的唯一权威转移，禁止回退。
- **文件隐私**：打印文件含用户文档，OSS 需私有 + 签名 URL 短时效，任务成功后按策略清理。
- **回调可达性**：链科需能公网访问后端回调；部署环境若无公网入口需内网穿透/网关转发。
- **幂等**：支付成功 MQ 可能重投，提交打印任务前须按 `orderNo`/`task_id` 去重，防重复打印扣费。

## Acceptance Criteria

- [ ] 后端 `DeviceTypeEnum` 支持 `PRINTER`，`yshop_device` 可存储打印机设备
- [ ] 后端实现链科云打印 Gateway（提交任务、查询状态、取消任务），经按类型分发的 `DeviceGateway` 调用
- [ ] 后端实现打印回调端点 `/app-api/device/printer/callback`：校验 device_id/task_id/状态转移合法性，更新设备订单 + 业务订单状态，幂等
- [ ] 打印店与云盒一一对应：`shop_code = device_code = deviceId`（一店一盒一打印机）
- [ ] 打印商品关联该打印机，规格来自打印机能力参数
- [ ] 用户下单 → 支付成功 → 自动提交打印任务 → 回调同步状态的完整流程
- [ ] 打印失败自动退款（`refund_status` 0→1→2，主状态 -2）
- [ ] 管理后台支持打印店/打印机/打印任务管理
