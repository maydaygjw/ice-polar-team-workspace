# 订单状态转移状态机

## 1. 文档定位

本文是订单状态的 Reference，供后端、管理后台、小程序和设备模块实现、联调、排障时使用。

### 适用范围

- `yshop_store_order.status`：业务订单主状态。
- `yshop_store_order.paid`：支付状态，作为主状态的前置条件，不替代主状态。
- `yshop_store_order.refund_status`：退款子状态，与主状态并行。
- `order_type = site` 的服务订单状态。
- 设备/打印订单状态与业务订单主状态的映射。

### 不纳入本文主状态机的字段

`due_status`、`audit_status`、`reply_status`、支付单 `status`、设备订单 `status` 都是辅助或子状态，本文只在相关转移处说明其触发关系。

## 2. 核心原则

订单不能用一个整数解释全部业务阶段。读取订单展示状态时，应至少组合判断：

```text
展示状态 = paid + status + refund_status + order_type
```

优先级建议如下：

1. `refund_status = 1`：退款中。
2. `refund_status = 2`：已退款。
3. `refund_status = 3`：退款已拒绝。
4. `paid = 0 && status = 0`：未支付。
5. 其余情况按 `status` 和 `order_type` 展示。

退款状态变化通常不修改 `status`；只有“管理员取消订单并退款”这一条路径会同时将主状态写为 `-2`。

## 3. 主订单状态

### 3.1 状态定义

| `status` | 业务含义 | 说明 |
|---:|---|---|
| `0` | 待制作 / 准备中 | 未支付时展示“未支付”；已支付后通常展示“制作中”。服务订单还表示等待审核、分配服务人员。 |
| `1` | 待收货 / 配送中 | 外卖、堂食出单或设备任务完成后进入。自取和收银模式通常跳过该状态。 |
| `2` | 已收货 / 待评价 | 用户收货、自动收货、配送完成或服务完成后进入。 |
| `3` | 已完成 | 所有商品评价完成后进入；堂食支付成功时可能直接进入。 |
| `-2` | 已退款并取消 | 仅“管理员取消订单并退款”当前实现会写入。 |
| `-4` | 已取消 | 仅保留订单记录的未支付取消接口会写入；普通用户取消和普通超时取消会删除订单记录。 |

`OrderStatusEnum` 中的 `-1`、`-3` 是历史/展示兼容值，当前主订单代码没有稳定的写入路径；退款中的、已拒绝的状态应以 `refund_status = 1/3` 为准。

### 3.2 合法主状态变迁

| 起始状态 | 目标状态 | 触发事件 | 触发方 / 入口 | 前置条件与副作用 |
|---:|---:|---|---|---|
| 无 | `0` | 创建订单 | C 端下单、服务订单创建、设备订单创建 | 初始化 `paid=0`、`refund_status=0`，扣减库存并创建订单记录。 |
| `0` | `0` | 支付成功 | 支付回调 `order.pay.notice`、线下支付、余额支付 | 普通订单只更新 `paid=1`、支付时间和支付单号；订单进入制作队列。 |
| `0` | `3` | 堂食支付成功 | `paySuccess()` | `order_type=desk` 时直接完成；同时 `paid=1`，更新桌台状态。 |
| `0` | `1` | 商家出单/发货 | 管理端订单发货接口 `updateStoreOrder()` | 外卖、堂食订单；写入发货日志并加入自动收货延时队列。 |
| `0` | `1` | 设备任务完成 | 制冰设备成功回调、打印任务 `SUCCEEDED` | 必须已支付；设备订单成功后通过 `OrderApi` 推进业务订单。打印任务随后尝试创建配送单。 |
| `0` | `1` | 推进配送中 | `OrderApi.pushOrderToDelivering()` | 仅允许当前 `status=0`，重复调用保持幂等。 |
| `0` | `2` | 自取/收银直接完成取货 | 管理端发货接口内部调用 `takeStoreOrder()` | `order_type=in/cashier` 通常跳过配送状态，直接确认收货。 |
| `1` | `2` | 用户确认收货 | App `POST /order/take` | 写入收货日志；Adapay 订单在满足条件时触发分账。 |
| `1` | `2` | 自动确认收货 | 收货延时队列 | 外卖/堂食发货后由 `OrderAutoConfirmListener` 或对应监听器调用 `takeOrder()`。 |
| `1` | `2` | 配送完成 | 设备打印配送回调 | `DeliveryStatusService` 收到送达/完成状态后调用 `OrderApi.updateOrderStatus(..., 2)`。 |
| `2` | `3` | 全部商品评价完成 | App 评价接口 | 所有订单商品均已评价时写入 `status=3`。 |
| `0` | `-4` | 保留订单记录的未支付取消 | `OrderApi.cancelUnpaidOrderKeepRecord()` | 仅 `paid=0`；回库存，不删除订单。主要供服务订单取消使用。 |
| 任意已支付状态 | `-2` | 管理员取消并退款 | `POST /admin-api/order/store-order/cancelAndRefund` | 先完成退款，再写入主状态 `-2`；同时 `refund_status=2`。 |

### 3.3 主状态禁止变迁

以下路径不属于合法业务转移：

| 禁止路径 | 原因 |
|---|---|
| `3 → 0/1/2` | 已完成订单不可回到履约中。 |
| `2 → 0/1` | 已收货订单不可重新制作或发货。 |
| `1 → 0` | 配送/待收货不可回退到制作中。 |
| `-2/-4 → 任意正常状态` | 退款完成、取消均为终态。 |
| 未支付订单直接进入 `1/2/3` | 除非是明确的线下支付/堂食特例，否则必须先完成支付。 |
| 通过通用接口任意改写状态 | `updateOrderStatus()` 当前没有状态白名单和前置状态校验，调用方必须自行保证只使用上述合法路径。 |

## 4. 退款状态机

### 4.1 状态定义

| `refund_status` | 含义 | 是否终态 |
|---:|---|---|
| `0` | 正常，未进入退款流程 | 否 |
| `1` | 退款中 / 待管理员审核 | 否 |
| `2` | 已退款 | 是 |
| `3` | 退款已拒绝 | 条件终态；允许再次申请时可回到 `1` |

### 4.2 合法退款变迁

| 起始状态 | 目标状态 | 触发事件 | 触发方 / 入口 | 前置条件与副作用 |
|---:|---:|---|---|---|
| `0` | `1` | 用户申请退款 | App `POST /app-api/order/refund` | 保存用户退款原因、图片和时间；记录 `apply_refund` 日志；外卖订单尝试取消同城配送。 |
| `3` | `1` | 被拒后重新申请 | 同一退款接口 | 仅 `refund_reapply=1`；覆盖本次用户退款资料并清空管理员拒绝原因。 |
| `1` | `2` | 管理员确认退款 | Admin `POST /admin-api/order/store-order/refund` | 调用支付渠道退款；回滚库存、佣金和门店收入；记录 `refund_price_success`。 |
| `1` | `2` | 设备任务失败/取消自动退款 | `OrderApi.autoRefundOrder()` | 自动设置 `refund_status=1` 后调用正式退款；成功后为 `2`，失败保留 `1` 并告警人工处理。 |
| `1` | `3` | 管理员拒绝退款 | Admin `POST /admin-api/order/store-order/reject-refund` | 保存拒绝原因和 `refund_reapply`；清空当前用户退款资料；不动资金、库存、佣金。 |
| `1` | `2` + 主状态 `-2` | 管理员取消并退款 | Admin `cancelAndRefund` | 这是退款状态和主状态同时变化的特例。 |

### 4.3 退款禁止变迁

- `2 → 1`：已退款订单不可再次申请。
- `2 → 3`：已退款订单不可拒绝。
- `3 → 1`：只有 `refund_reapply=1` 才允许。
- `3 → 2`：被拒订单不能绕过重新申请直接确认退款。
- `0 → 2`：不能跳过退款中直接确认退款；自动退款也必须先建立退款中状态。
- `refund_status` 变化不应覆盖履约主状态，除 `cancelAndRefund` 的明确特例外。

## 5. 站点服务订单状态

站点服务复用 `yshop_store_order.status`，但状态语义由 `SiteOrderStatusEnum` 定义，并由 `audit_status + staff_id` 补充表达准备阶段。

| 起始状态 | 目标状态 | 触发事件 | 前置条件 |
|---:|---:|---|---|
| 无 | `0` 准备中 | 创建服务订单 | 初始未支付；支付成功后仍保持 `0`。 |
| `0` | `0` | 审核通过、分配服务人员 | 只修改 `site_order.audit_status/staff_id`，不推进主状态。 |
| `0` | `1` 服务中 | 管理端开始服务 | 已审核通过且已分配服务人员。 |
| `1` | `2` 待评价 | 管理端完成服务 | 写入服务结束时间，并更新服务人员工作数据。 |
| `2` | `3` 已完成 | 所有商品评价完成 | 沿用通用订单评价逻辑。 |
| `0` | `-4` 已取消 | 用户取消未支付服务订单 | 调用 `cancelUnpaidOrderKeepRecord()`，回库存并保留记录。 |

注意：`SiteOrderStatusEnum` 虽然定义了 `-1/-2/-3` 退款相关值，但当前服务订单退款实现仍通过公共 `refund_status` 表达，不能根据这些枚举值推断数据库中的实际退款流转。

## 6. 设备/打印订单映射

设备订单有独立的 `DeviceOperationOrderStatusEnum`，设备状态终态不能逆转；它只通过 `bizOrderId` 驱动业务订单或退款状态。

| 设备事件 | 设备订单结果 | 业务订单动作 |
|---|---|---|
| 支付通知 | 创建/排队 | 业务订单已支付，主状态通常保持 `0`。 |
| 任务处理中 | `PROCESSING` | 业务订单保持 `0`。 |
| 制冰成功 / 打印成功 | `SUCCEEDED` | 业务订单 `0 → 1`，进入待收货/配送中。 |
| 配送送达 | `DELIVERED/COMPLETED` | 业务订单 `1 → 2`。 |
| 用户评价 | — | 业务订单 `2 → 3`。 |
| 设备任务失败/取消 | `FAILED/CANCELLED` | 触发自动退款，退款状态走 `0 → 1 → 2`；自动退款失败保留 `refund_status=1` 并告警。 |

设备订单的中间态、失败态和业务订单主状态不能互相直接赋值。

## 7. 事件清单

| 事件 | 来源 | 主要处理 |
|---|---|---|
| `CREATE_ORDER` | C 端/服务订单创建 | 创建主订单，初始化 `status=0, paid=0, refund_status=0`。 |
| `PAY_ORDER_SUCCESS` | 支付回调、线下支付 | `paid=1`；堂食订单可能直接 `status=3`；普通订单触发制作/设备流程。 |
| `DELIVERY_GOODS` | 管理端发货 | 普通外卖/堂食 `0→1`，启动自动收货计时。 |
| `TAKE_ORDER_DELIVERY` | 用户确认或自动确认收货 | `1→2`，触发积分、成长值及可能的分账。 |
| `EVAL_ORDER` | 用户评价 | 全部商品评价完成后 `2→3`。 |
| `REFUND_ORDER_APPLY` | 用户申请退款 | `refund_status 0/3→1`。 |
| `REFUND_ORDER_REJECT` | 管理员拒绝退款 | `refund_status 1→3`。 |
| `REFUND_ORDER_SUCCESS` | 管理员/自动退款成功 | `refund_status 1→2`，执行资金和库存补偿。 |
| 未支付超时 | Redis 延时队列 | 当前普通实现调用 `cancelOrder()` 删除订单记录；不是统一的 `status→-4`。 |
| 设备任务失败/取消 | 设备/打印回调 | 自动退款，不应直接改写业务订单为设备状态。 |

## 8. 实现约束与待修正项

### 8.1 当前实现与状态机的偏差

1. `OrderApiImpl.updateOrderStatus()` 直接写入传入值，没有校验起始状态、支付状态或目标状态白名单。
2. `markOrderCompleted()` 方法名容易误导，实际将主状态写为 `2`，表示已收货/待评价；真正的 `3` 通常由评价完成触发。
3. 普通用户取消和未支付超时取消会删除订单；只有 `cancelUnpaidOrderKeepRecord()` 才写 `status=-4`。两种取消语义需要在 API 文档中明确区分。
4. 自动退款成功会更新 `refund_status=2`，但 `autoRefundOrder()` 本身没有统一将业务主状态写成 `-2`；打印订单设计文档中的“主状态 -2”与当前实现不完全一致。
5. `OrderStatusEnum`、`OrderInfoEnum`、站点 `SiteOrderStatusEnum` 对同一数值的文案并不完全一致，调用方不能仅依据枚举名称判断实际业务含义。

### 8.2 后续代码治理建议

- 将主状态变更集中到状态机服务，所有变更采用 `fromStatus + event + guard` 校验。
- 将退款状态变更集中到退款状态机，确认退款和拒绝退款使用条件更新，避免管理员并发操作覆盖。
- 对 `updateOrderStatus()` 增加合法转移矩阵和幂等规则，禁止任意状态写入。
- 统一前端、API DTO、后端枚举中的状态文案，尤其是 `status=0` 的“未支付/制作中”双重展示语义。
- 为每次状态变更记录：订单号、旧状态、新状态、事件、操作者、来源和时间；订单状态日志不可覆盖。

## 9. 主要实现依据

- [OrderInfoEnum.java](../../backend/yshop-framework/yshop-common/src/main/java/co/yixiang/yshop/framework/common/enums/OrderInfoEnum.java)
- [OrderStatusEnum.java](../../backend/yshop-module-mall/yshop-module-order-api/src/main/java/co/yixiang/yshop/module/order/enums/OrderStatusEnum.java)
- [OrderApiImpl.java](../../backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/api/OrderApiImpl.java)
- [AppStoreOrderServiceImpl.java](../../backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/AppStoreOrderServiceImpl.java)
- [StoreOrderServiceImpl.java](../../backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/service/storeorder/StoreOrderServiceImpl.java)
- [SiteOrderStatusEnum.java](../../backend/yshop-module-site/yshop-module-site-api/src/main/java/co/yixiang/yshop/module/site/enums/SiteOrderStatusEnum.java)
- [PrintShopService.java](../../backend/yshop-module-device/yshop-module-device-biz-print/src/main/java/co/yixiang/yshop/module/device/printer/service/PrintShopService.java)
- [DeliveryStatusService.java](../../backend/yshop-module-device/yshop-module-device-biz-print/src/main/java/co/yixiang/yshop/module/device/printer/delivery/service/DeliveryStatusService.java)

