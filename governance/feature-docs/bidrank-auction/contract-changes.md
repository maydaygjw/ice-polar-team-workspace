# 商圈排名竞价 — Contract Changes

功能级契约增量。平台级规则无变化：`N/A`（沿用 `ARCHITECTURE.md`）。

> **交付分期**：本期落地 = 模块依赖、Admin 活动/档位配置与周期管理 API、store 通用排序 API、DB Schema、权限/套餐授权。标注「延后期」的小节（竞价结算调用、App API、MQ、排序注入）随小程序交付。

## 模块依赖

新增：`bidrank-api` 仅承载竞价模块自身对外 API；通用门店排序能力归 `store-api`。`bidrank-biz` 依赖 `pay-api`、`store-api`，`store-biz` 不依赖 `bidrank-api`。无跨模块直连 `-biz`。

## 跨模块 API（store-api）

```
StoreShopSortApi.upsert(StoreShopSortSaveDTO) : Long
StoreShopSortApi.disableBySource(String sourceCode, String sourceRecordId) : void
StoreShopSortApi.listActiveSort(Long businessRegionId) : List<StoreShopSortDTO>

StoreShopSortSaveDTO {
  Long businessRegionId;
  Long storeId;
  String sourceCode;
  String sourceRecordId;
  Integer rankStart;
  Integer rankEnd;
  LocalDate effectStartDate;
  LocalDate effectEndDate;
}
StoreShopSortDTO { Long storeId; Integer rankStart; Integer rankEnd; }
```

语义：store 模块拥有排序结果表并实现该 API，负责租户/部门派生、来源隔离、幂等写入、失效和有效期过滤；不解析 `sourceCode` 的业务含义。返回某商圈当前生效的门店及其排名范围；无数据返回空列表。随机落位由 store 门店列表在范围内完成。

竞价模块写入时使用 `sourceCode="bidrank"`；`sourceRecordId` 由竞价模块自行定义，store 模块只做来源隔离和幂等键。

## Admin API（`/admin-api/bidrank/...`，权限 `bidrank:*`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/auction/create` | `bidrank:auction:create` | 建活动（含档位列表） |
| PUT | `/auction/update` | `bidrank:auction:update` | 改活动；存在任意周期时拒绝 |
| GET | `/auction/page` | `bidrank:auction:query` | 分页 |
| GET | `/auction/get` | `bidrank:auction:query` | 详情（含档位） |
| DELETE | `/auction/delete` | `bidrank:auction:delete` | 删活动；存在任意周期时拒绝 |
| PUT | `/auction/enable` | `bidrank:auction:update` | 启用/停用；存在任意周期时拒绝 |
| POST | `/auction/{auctionId}/cycle/generate?occurrence=1` | `bidrank:auction:update` | 按活动模板生成指定序号的待开始周期；`occurrence` 可选 1/2/3，分别表示下一次、下 2 次、下 3 次，按竞价开始时间幂等 |
| GET | `/cycle/page` | `bidrank:cycle:query` | 竞价周期分页查询 |
| PUT | `/cycle/{cycleId}/open` | `bidrank:auction:update` | 手动开启待开始周期 |
| PUT | `/cycle/{cycleId}/final-pay` | `bidrank:auction:update` | 手动将竞价中周期切换为可付尾款；只按状态开放尾款 |
| PUT | `/cycle/{cycleId}/settle` | `bidrank:auction:update` | 手工结算可付尾款周期，不判断时间 |
| PUT | `/cycle/{cycleId}/terminate` | `bidrank:auction:update` | 终止周期并逻辑删除；终止后不再支付和结算 |
| DELETE | `/cycle/{cycleId}` | `bidrank:auction:update` | 逻辑删除待开始周期 |
| GET | `/order/page` | `bidrank:order:query` | 出价单/价格栈监控（延后期，依赖竞价数据） |

活动变更保护：`/auction/update`、`/auction/delete`、`/auction/enable` 以及活动档位更新均需检查当前租户活动是否存在任意未删除周期；存在时返回 `AUCTION_HAS_CYCLE`，不改变活动。

## App API（`/app-api/bidrank/...`，需登录 + 租户 feature flag，延后期）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/auction/list` | 本商圈生效活动 + 档位 |
| GET | `/rank/status` | 某档位状态：起拍价、名额、已出价数、是否已满；**已满**时返回最低入围价，未满不返回 |
| POST | `/bid` | 出价/加价（返回预付 pay 参数） |
| POST | `/final-pay` | 付尾款（返回 pay 参数） |
| GET | `/my-order/page` | 我的竞拍与状态 |

响应统一 `CommonResult`。金额单位元（`decimal(10,2)`）。活动/门店 ID 为 Long，出价单 ID 为 String(32)。

## 事件 / MQ（RocketMQ，延后期）

| Topic/Tag | 生产者 | 消费者 | 语义 |
|-----------|--------|--------|------|
| `bidrank_refund` | `BidRankSettleJob` | `BidRefundConsumer` | 未中标出价全额异步退款 |

退款经 `pay-api`，幂等按 `yshop_bid_order.status` 机；消息含 `orderId`。

## 定时任务（Quartz）

| Job | 触发 | 动作 |
|-----|------|------|
| `BidCycleOpenJob` | 周期 `bid_start_time` 到达 | 按租户、活动和竞价开始时间查询周期；已有已开启/已结束周期则跳过，已有待开始周期则开启，没有则生成并开启 |
| `BidRankSettleJob` | 活动 `final_pay_deadline` 后 | 结算入围、经 `StoreShopSortApi` 写排序结果、发退款 MQ、作废未付清 |
| `BidSortExpireJob` | 每日 | 过期排序置失效 |

`BidCycleOpenJob` 与周期生成/手动开启接口使用同一幂等键 `tenant_id + auction_id + bid_start_time` 和分布式锁；手动开启成功后，定时任务不再重复生成或开启该周期。

## DB Schema

升级脚本：`sql/upgrade-2026-07-22-bidrank-auction.sql`。新增 5 张竞价表及 1 张 store 模块拥有的通用排序表（DDL 见 `technical-design.md`）+ 菜单 seed + 套餐授权样例。

- `yshop_bid_auction` 为周期模板（cycle_type/anchor_effect_date/advance_days/start_time/duration_minutes/pay_minutes/enabled/description/rules）。
- `yshop_bid_auction_cycle` 为周期实例，包含 `effect_date`、`bid_start_time`、`bid_end_time`、`final_pay_deadline` 和 `status`；周期时间从活动模板派生，生成后不随模板修改回溯。
- 周期生成/开启按 `tenant_id + auction_id + bid_start_time` 幂等；状态为待开始、竞价中、可付尾款、已结算；终止周期逻辑删除后不再参与支付和结算。
- 同一竞价活动最多同时存在 3 个“竞价中”周期；超过上限时手动开启和自动开启均拒绝/暂缓。
- 周期删除只允许待开始状态，使用 BaseDO 的 `deleted` 字段逻辑删除，已进入竞价流程的周期保留历史。
- 竞价表含 `tenant_id` + BaseDO；`yshop_bid_rank/yshop_bid_order/yshop_bid_order_his` 关联 `auction_id`。
- 通用排序表由 store 模块拥有，表名为 `yshop_store_shop_sort`，含 `tenant_id`、`dept_id`、`business_region_id`、`store_id`、来源标识、排名范围和生效期；不含 `auction_id` 或其他竞价专属字段。
- 出价单 ID String(32)，金额 bigint（分）。
- 破坏性变更含回滚（DROP TABLE + DELETE 菜单/授权）。
- 历史表 `yshop_bid_order_his`、结算/退款相关字段不可变。

## 权限 / 数据范围

- 后台 `@PreAuthorize("@ss.hasPermission('bidrank:...')")`；菜单挂 `bidrank` 树，经租户套餐 `menu_ids` 授权售卖。
- 数据权限：商圈/门店范围过滤沿用 `dept_id` + 门店数据权限；查询默认租户隔离。

## 前端消费者同步

- admin（本期）：活动/档位配置、周期生成（下一次/下 2 次/下 3 次）与竞价周期管理菜单/页面，支持删除待开始周期，权限码对齐上表。
- admin（延后）：竞拍监控/入围结果页。
- miniapp（延后）：竞价入口/出价/支付页，受租户 feature flag 显隐。
