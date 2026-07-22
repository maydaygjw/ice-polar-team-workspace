# 商圈排名竞价（二期）— Contract Changes

功能级契约增量，承接一期 `../bidrank-auction/contract-changes.md`。

本期契约只覆盖最小闭环：单档位内加价、两段支付、简单结算和通用排序结果写入。并发控制、动态竞争和复杂退款状态不进入本期契约。

## 模块依赖

- `bidrank-biz` → `pay-api`：创建预付/尾款支付单，发起未中标退款。
- `bidrank-biz` → `store-api`：校验门店/商圈/门店管理员关系，并通过 `StoreShopSortApi` 写入排序结果。
- `store-biz` 不依赖 `bidrank-api`；门店列表读取 store 自己拥有的通用排序结果。
- 本期不新增 `system-api` 依赖；租户隔离沿用框架，套餐开关暂不做 app 侧动态判定。
- 无跨模块直连 `-biz`。

## 跨模块 API

### store-api（复用一期契约）

二期不新增 bidrank 排序 API，直接使用一期已落地的通用接口：

```
StoreShopSortApi.upsert(StoreShopSortSaveDTO) : Long
StoreShopSortApi.disableBySource(String sourceCode, String sourceRecordId) : void
StoreShopSortApi.listActiveSort(Long businessRegionId) : List<StoreShopSortDTO>
```

结算写入时：

```
sourceCode     = "bidrank"
sourceRecordId = String.valueOf(cycleId)
```

store 模块负责 `tenant_id`、`dept_id`、门店归属和有效期，不解析竞价来源内容。

出价阶段复用 `StoreShopQueryApi.getShopInfo(shopId)`；`StoreShopInfoDTO` 需要补充 `businessRegionId`，用于校验门店属于当前周期商圈。

```
StoreShopQueryApi.isShopAdmin(Long shopId, Long userId) : boolean
```

### pay-api（最小新增）

```
PayOrderApi.createPayOrder(PayOrderCreateReqDTO) : PayOrderRespDTO
PayOrderApi.refund(PayRefundReqDTO) : boolean
```

- `PayOrderCreateReqDTO` 包含 `orderId`、`amount`、`title`、`payType`、`from`、`userId` 和 `bizType`；`orderId` 是竞价预付/尾款支付单号，pay 不解析竞价业务。
- `PayRefundReqDTO` 包含支付单号、渠道、退款金额、原支付金额和 `bizType`。
- `bizType` 使用 `"bidrank"`，只用于支付通知分流和退款路由。
- `PayOrderRespDTO` 返回支付参数，字段按现有 pay 模块结构落地；bidrank 不感知微信、支付宝或 AdaPay。
- 本期不设计渠道切换、渠道抽象和支付单重构。

## App API（`/app-api/bidrank/...`）

| 方法 | 路径 | 请求/返回 | 说明 |
|------|------|-----------|------|
| GET | `/auction/current` | `businessRegionId` → 活动和档位 | 只返回当前可报名周期 |
| POST | `/bid` | `{cycleId, rankId, storeId, price}` → 本次预付支付参数 | 首次选择档位并出价；上一笔预付成功后，后续只能在同一档位加价 |
| POST | `/final-pay` | `{bidOrderId}` → 尾款支付参数 | 仅预付成功且未超过截止时间可调用 |
| GET | `/my-order/page` | 分页参数 → 出价单 | 仅查询当前用户出价单 |

统一使用 `CommonResult`。金额单位为元，出价单 ID 为 `String(32)`。

本期不提供 `/rank/status`、最低入围价或价格栈接口；加价复用 `/bid`。

## Admin API（`/admin-api/bidrank/...`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/order/page` | `bidrank:order:query` | 出价单分页查询 |
| GET | `/order/result` | `bidrank:order:query` | 按 `cycleId` 查询中标结果 |

## 支付通知与退款

### 支付通知

- 继续使用 Redis Stream `order.pay.notice`。
- `PayNoticeMessage` 增加通用 `bizType`，普通商城订单默认 `store_order`，竞价支付使用 `bidrank`。
- order 消费者只处理 `store_order`/空值；bidrank 消费者只处理 `bidrank`。
- 预付通知记录预付已支付状态与金额；尾款通知将出价单置为“已付全款”并记录 `final_pay_time`。

### 未中标退款

```
BidRankSettleJob -> PayOrderApi.refund(PayRefundReqDTO)
```

本期结算任务直接完成一次退款调用并记录结果；失败重试、对账和人工补偿列入后续。

## 定时任务

| Job | 触发 | 动作 |
|-----|------|------|
| `BidCycleScheduleJob` | 每日一次 | 为启用活动创建当前周期实例 |
| `BidRankSettleJob` | 每分钟一次 | 找到截止周期，按最终出价降序、尾款支付时间升序取前 `slot_count` 个，写排序并发退款 |

本期不新增 `BidSortExpireJob`；有效期过滤由 `StoreShopSortApi`/store 查询完成。

## DB Schema

升级脚本：`sql/upgrade-2026-07-22-bidrank-auction-phase2.sql`。

- 新增 `yshop_bid_auction_cycle`：
  `id / tenant_id / auction_id / business_region_id / effect_date / bid_start_time / bid_end_time / final_pay_deadline / status / BaseDO`。
- `yshop_bid_order` 增加 `cycle_id` 和 `final_pay_time`；唯一约束调整为 `(cycle_id, store_id)`，首次确定的 `rank_id` 不可变。
- `yshop_bid_order.final_pay_deadline` 在二期启用；一期状态值继续沿用。
- `pay_out_order_no` 增加通用 `biz_type`，用于支付通知分流；不增加渠道专属字段。
- 不新增排序表；排序结果使用一期的 `yshop_store_shop_sort`。
- 菜单新增 `bidrank:order:query` 及监控/结果页，脚本必须含回滚。

## 权限与数据范围

- admin 接口使用 `@PreAuthorize("@ss.hasPermission('bidrank:order:query')")`。
- 租户隔离沿用框架；出价单含 `tenant_id`、`dept_id`。
- 排序结果由 store API 派生 `dept_id`，bidrank 不直接写表。

## 明确 Out of Scope

- Redisson/lock4j 并发锁和抢位公平性。
- 最低入围价、实时价格栈和多种竞价策略；本期只支持同一档位的基础加价。
- 支付通知完整幂等状态机、退款自动重试、对账和人工补偿。
- 小程序页面、运营手工干预和 BI 报表。

## Phase3 契约待办

后续新增或扩展契约时，按以下顺序处理：

1. **并发与幂等契约**：出价请求幂等号、周期/档位锁定语义、重复支付通知和重复结算的状态转换。
2. **竞价契约**：最低入围价、档位实时状态、价格栈、更严格的同价排序规则和完整竞争展示。
3. **财务契约**：预付/尾款/退款状态机、退款重试与人工补偿接口、支付对账字段和告警事件。
4. **运营契约**：周期暂停/重开、配置冻结、结算重跑、结果撤回和操作审计。
5. **客户端契约**：小程序竞价页面、实时状态刷新和支付异常提示。

Phase3 不改变一期 `StoreShopSortApi` 的通用来源字段；竞价能力继续通过 `sourceCode="bidrank"` 写入排序结果。
