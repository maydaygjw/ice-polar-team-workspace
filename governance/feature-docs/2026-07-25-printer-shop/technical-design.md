# printer-shop 技术设计

关联：BACKLOG-008、`governance/KNOWLEDGE/lianke-cloud-print-api.md`、本目录 `contract-changes.md`。

## 1. 模块影响

| 模块 | 影响 |
|------|------|
| `yshop-module-device-api` | `DeviceTypeEnum` 增加 `PRINTER("printer","打印机")`；新增打印相关 DTO |
| `yshop-module-device-biz` | 新增 `device/printer/`：`LiankePrinterGateway`（HTTP 直连链科）、打印 Service、**`PrintPayNoticeConsumer`（监听 `order.pay.notice`，在 device-biz）**、打印专属计价器、回调 Controller、`PrintDeliveryGateway` 占位接口；`DeviceManagementServiceImpl` 硬编码 ICE_MAKER 处改为按类型分发 |
| `yshop-module-order-biz` | 复用既有 OrderApi（状态推进/退款），新增按页计价所需订单数据读取；**不新增打印 consumer**（在 device-biz） |
| `yshop-module-pay` | 无改动（复用现有支付/退款通道） |
| `yshop-module-product` | 复用 SKU（`StoreProductAttrValueDO`）承载打印规格单价；如需跨模块查 SKU 规格，扩展 `ProductApi` |
| admin (yshop-drink-vue) | **仅新增「打印任务管理」页**；打印店用现有门店管理，打印机用现有商品管理 |

依赖方向：跨模块只经 `-api`。Device → Order 走 `OrderApi`；Order 不依赖 Device（支付通知经 MQ 解耦，device-biz 消费）。

## 2. 关键决策

### D1 设备网关分发
现状 `DeviceManagementServiceImpl` 字段注入 `iceDeviceGateway` 且硬编码 `ICE_MAKER`。
决策：抽通用 `DeviceGateway` 接口（connect/queryStatus/initiateOrder/queryOrder/cancel 等），`IceDeviceGateway`、`PrinterGateway` 各自 extends/实现；新增按 `DeviceTypeEnum` 的 `Map<DeviceTypeEnum, DeviceGateway>` 注册表，运行时按 `deviceType` 路由。
权衡：比 if/else 分支更干净，为后续更多设备类型铺路；改动集中在 Device 模块内部，不影响 ICE_MAKER 现有行为。

### D2 打印触发：支付成功自动提交
决策：支付成功后自动提交打印任务（区别于制冰机的手动 `_initiateDirect`）。
实现位置二选一：
- (a) 新增 `PrintPayNoticeConsumer` 监听 `order.pay.notice`，按 bizType/orderType 过滤后调 Device 提交；
- (b) 在 `AppStoreOrderServiceImpl.paySuccess` 内部分支。
倾向 (a)：MQ 解耦、天然异步、不阻塞 paySuccess 主流程；幂等键 = orderNo。
权衡：需保证提交幂等（MQ 重投）与失败补偿（提交失败可重试/人工干预）。

### D3 文件传递与页数
链科 `jobFile` 支持 URL。决策：文件先存 OSS 私有桶，提交时用短时效签名 URL + `urlFileExt`。
风险：URL 过期导致链科拉取失败 → 视为打印失败；签名时效需 > 链科解析窗口（PARSING），建议 ≥ 10 分钟。

### D3b 页数计价（不侵入通用价格逻辑）
打印按页计价，区别于普通商品。决策：
- 下单时前端传入**页数**（用户上传文件后由前端/后端解析附件得出）；后端用附件实际页数**校验**入参，不一致拒绝下单。
- 价格 = 单价(来自 SKU 规格：纸张/颜色等) × 页数 × 份数。该计算走**打印专属计价器**，不改通用订单价格引擎。
- 边界：计价器在打印订单创建路径生效（orderType=device + deviceType=printer）；普通商品价格逻辑零改动。
- 附件解析页数（**方案 B**）：PDF 取页数、图片计 1 页，下单时后端即校验入参 `pageCount`；Office 文档（Word/Excel）后端不解析，页数以**链科解析结果**为准——提交任务后回读链科返回的实际页数比对，不符则按打印失败自动退款。

### D4 打印成功 → 配送下单（接口未定）
`DeviceOrder` 到 SUCCEEDED（打印完成）后，需向**配送平台**发起配送下单，把打印件送达用户。
- 配送平台接口**暂未提供**，本期预留扩展点：定义 `PrintDeliveryGateway` 接口（占位），SUCCEEDED 时调用；实现类先空实现/记日志，待配送平台契约补齐后接。
- 业务主状态含 `2 已送达/待评价`：SUCCEEDED → status=1（待收货/配送中）→ 配送完成 → status=2（已送达，可评价）→ 用户评价 → status=3（已完成）。
- 因配送接口未定，status=2 的推进先由配送回调（未来）或人工触发，本期不自动推进到 2。

### D4 回调真实性与幂等（无签名）
链科回调无签名。决策：三重校验 + 前进式状态机 + 幂等（**不加路径 token**，由用户确认）。
- 校验：`device_id` 存在于本地设备表且 type=printer；`task_id` 匹配本地未终态 DeviceOrder；目标状态在当前状态之后（只前进）。
- 幂等：以 `task_id` 为键，重复回调直接返回成功不重复转移。
- 终态（SUCCEEDED/FAILED/CANCELLED）不可逆；SUCCESS 后收到 FAILURE/REVOKED 丢弃。
- 残余风险：task_id/device_id 可被猜测，存在伪造推进状态/触发退款风险——已被用户接受，不在 URL 加 token。记录于风险表。

### D5 状态映射（权威：订单模块设计 §6.3/§6.4）
```
云 task_state      DeviceOrder.status   业务 status          业务 paid/refund
READY              QUEUED               0 待制作             paid=1
PARSING/SENDING    PROCESSING           0 待制作             paid=1
SUCCESS            SUCCEEDED            1 待收货/配送中       paid=1   → 触发配送平台下单(接口未定)
(配送完成)          -                    2 已送达/待评价      paid=1   → 可评价
(用户评价)          -                    3 已完成             paid=1
FAILURE            FAILED               → 自动退款            refund_status 0→1→2, 终态 -2
REVOKED            CANCELLED            → 自动退款(若已付)    refund_status→2
```
业务主状态用 0/1/2/3 全链：0 待制作 → 1 配送中（打印完成即发配送）→ 2 已送达（可评价）→ 3 已完成。失败原因写 `DeviceOrderDO.failureReason`（取 `task_result.code/msg`）。

### D5b 订单状态推进责任
- DeviceOrder.status 由链科回调推进（device-biz）。
- 业务订单 status 推进：1（SUCCEEDED 后，随配送下单）、2（配送完成）、3（评价）。经 `OrderApi.updateOrderStatus`/`markOrderSettled` 等既有契约。

### D6 一店一盒一打印机
`deviceId` 同时作 `shop_code` 与 `device_code`，沿用 `device_code = shop_code` 惰性约定。设备入网/店铺绑定校验：deviceId 唯一、shop 存在且一致。不为多打印机建模。

## 3. 核心流程

### 下单-打印-配送-同步
```
用户下单(传页数+文件) → 打印计价器(单价×页数×份数) → 支付
  → MQ order.pay.notice
  → device-biz PrintPayNoticeConsumer(orderNo 幂等)
  → Device: 查 printer 设备/店铺、取 SKU 规格单价、文件签名URL → 组装 dmPaperSize/dmCopies/页数
  → LiankePrinterGateway.submitJob → 拿 task_id
  → DeviceOrder: CREATED→QUEUED, 存 task_id
链科回调 /app-api/device/printer/callback（原文打 debug 日志，不入库）
  → 校验 device_id/task_id/状态机（只前进）
  → DeviceOrder 前进转移
  → SUCCEEDED: 业务订单 → 1 配送中，并调 PrintDeliveryGateway 发起配送(接口未定,先占位)
       → 配送完成 → 2 已送达/可评价 → 用户评价 → 3 已完成
  → FAILURE/REVOKED: 触发自动退款 (refund_status 0→1→2, 主状态 -2)
```

## 4. 迁移 / 回滚

- 新增 `sql/upgrade-2026-07-25-printer-shop.sql`：`yshop_device_order` 增加 `task_id`、`extra_params`（json，设备类型私有参数；打印机存页数/规格快照）；`yshop_device` 增加 `device_key`、`device_port`、`device_model`（通用设备型号）。含回滚。不改 `yixiang-drink.sql`。`callback_payload` 不入库，仅 debug 日志。
- 设备订单/设备表保持通用：页数、型号等设备私有数据走 `extra_params`/`device_model`，不加类型专用列。
- 代码向后兼容：ICE_MAKER 路径不变；新增 PRINTER 不影响存量；通用价格引擎零改动（计价走打印专属计价器）。

## 5. 风险

| 风险 | 缓解 |
|------|------|
| 无签名回调被伪造推进状态/触发退款（**已接受**，不加 token） | 三重校验 + 前进式状态机；回调原文打 debug 日志供审计 |
| MQ 重投重复提交任务扣费 | orderNo 幂等键，提交前查已有 task_id |
| 签名 URL 过期 | D3 时效 ≥10min；失败按打印失败退款 |
| 状态乱序/回退 | 只前进状态机，终态不可逆 |
| 页数被篡改多收/少收 | 下单时后端用附件实际页数校验入参 |
| 配送平台接口未定 | `PrintDeliveryGateway` 占位；SUCCEEDED 后状态推进与配送解耦，接口补齐后接入 |
| 退款与状态一致性 | 复用订单退款流程；退款失败留人工处理入口 |
| 链科 SLA/超时 | 提交/查询设超时；超时未回调支持后台手动查询补偿 |

## 6. 契约变化

详见 `contract-changes.md`。
