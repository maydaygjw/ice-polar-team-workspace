# Backlog Item Template

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-006 |
| Title | 打印店（第三方云打印平台对接） |
| Status | `draft` |
| Priority | `P2` |
| Created | 2026-07-25 |
| Author | gejunwen |
| Tags | device, printer, shop, third-party, callback |

## Problem / Need

当前系统仅有制冰机一种设备类型和业态。需要引入第三方云打印平台（链科云打印），新增打印机设备类型和打印店业态，让用户可以在小程序上找到打印店、选择打印机、上传文件并完成打印。

核心场景：
- 用户扫描打印店二维码 → 进入打印店 → 选择打印机（商品）→ 设置打印规格 → 上传文件 → 支付 → 后台自动提交打印任务 → 打印完成通知用户

## Context

### 云打印平台（链科云打印 v3）

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

### 现有系统现状

- 设备模块已有通用 `yshop_device` / `yshop_device_order` 表，device_type 目前仅 ICE_MAKER
- 设备与店铺通过 `device_code = shop_code` 约定关联
- 订单表已有 `order_type = "device"` 用于设备订单
- `DeviceOperationOrderStatusEnum`：CREATED → QUEUED → PROCESSING → SUCCEEDED/FAILED/CANCELLED
- 商品表有多规格 SKU 系统（`yshop_store_product_attr_value`），可复用于打印设置
- 支付流程：createOrder → pay → MQ → paySuccess（可在 paySuccess 后触发打印）
- 小程序目前仅有制冰机流程（扫描→连接→选商品→支付→处理进度）

### 模型映射关系

```
云打印平台              →  系统内
云盒(deviceId)          →  打印店 (shop_code = deviceId)
打印机(USB端口)          →  商品 (Product)
打印机能力参数           →  商品规格 (ProductAttr/AttrValue)
提交打印任务             →  支付后动作
打印任务状态(task_state) →  设备订单状态 (DeviceOrder.status)
callbackUrl             →  后端回调端点 /app-api/print/callback
```

### 三层状态映射

```
业务订单状态            设备订单状态             云打印任务状态
0 未支付                CREATED                  -
1 待发货(已支付)         QUEUED                   READY
1 待发货                PROCESSING               PARSING/SENDING
2 待收货(打印完成)        SUCCEEDED                SUCCESS
4 已完成(用户确认)        -                        -
-                       FAILED                   FAILURE
-4 已取消               CANCELLED                REVOKED
```

### 涉及仓库

| 仓库 | 变更范围 |
|------|---------|
| `backend` (yshop-drink) | 新增 PRINTER 设备类型、PrintDeviceGateway、打印店 Service/Controller、回调端点 |
| `miniapp` (icepolarminiapp) | 新增打印店首页、打印商品详情/文件上传、打印进度页；扩展扫描/地图页 |
| `admin` (yshop-drink-vue) | 新增打印店管理、打印机管理、打印任务管理页面 |
| `icepolar-dms` | **无需变更**（打印机不经过 DMS） |

### 待确认问题

1. 云平台回调是否有签名验证机制？文档未明确说明。
2. 打印文件上传方案：小程序上传到后端 OSS，后端用文件 URL + urlFileExt 提交打印任务？
3. 定价模型：按页？按纸张/颜色？建议初期按商品固定价格 + 规格加价（复用 SKU 价格模型）。
4. 打印失败退款策略：自动退款还是人工审核？
5. 一云盒多打印机时，是一个打印店 → 多个商品？

## Acceptance Criteria

- [ ] 后端支持 PRINTER 设备类型，设备管理表可存储打印机设备
- [ ] 后端实现云打印平台 Gateway（提交任务、查询状态、取消任务）
- [ ] 后端实现打印回调端点，接收云平台回调并更新设备订单 + 业务订单状态
- [ ] 打印店作为一种门店类型存在，与云盒 deviceId 关联
- [ ] 打印商品关联打印机（devicePort + printerModel），规格来自打印机能力
- [ ] 用户下单 → 支付 → 自动提交打印任务 → 状态同步的完整流程
- [ ] 小程序支持打印店发现、文件上传、打印规格选择、支付、进度查看
- [ ] 管理后台支持打印店/打印机/打印任务管理
