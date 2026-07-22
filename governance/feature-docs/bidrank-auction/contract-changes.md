# 商圈排名竞价 — Contract Changes

功能级契约增量。平台级规则无变化：`N/A`（沿用 `ARCHITECTURE.md`）。

> **交付分期**：本期落地 = 模块依赖、Admin 活动/档位配置 API、store 通用排序 API、DB Schema、权限/套餐授权。标注「延后期」的小节（竞价结算调用、App API、MQ、Job、排序注入）随小程序交付。

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
| PUT | `/auction/update` | `bidrank:auction:update` | 改活动（仅草稿） |
| GET | `/auction/page` | `bidrank:auction:query` | 分页 |
| GET | `/auction/get` | `bidrank:auction:query` | 详情（含档位） |
| DELETE | `/auction/delete` | `bidrank:auction:delete` | 删（仅草稿） |
| PUT | `/auction/enable` | `bidrank:auction:update` | 启用/停用（切换 enabled） |
| GET | `/order/page` | `bidrank:order:query` | 出价单/价格栈监控（延后期，依赖竞价数据） |

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

退款经 `pay-api`，幂等按 `bid_order.status` 机；消息含 `orderId`。

## 定时任务（Quartz，延后期）

| Job | 触发 | 动作 |
|-----|------|------|
| `BidRankSettleJob` | 活动 `final_pay_deadline` 后 | 结算入围、经 `StoreShopSortApi` 写排序结果、发退款 MQ、作废未付清 |
| `BidSortExpireJob` | 每日 | 过期排序置失效 |

## DB Schema

升级脚本：`sql/upgrade-2026-07-22-bidrank-auction.sql`。新增 4 张竞价表及 1 张 store 模块拥有的通用排序表（DDL 见 `technical-design.md`）+ 菜单 seed + 套餐授权样例。

- `bid_auction` 为周期模板（cycle_type/anchor_effect_date/advance_days/start_time/duration_minutes/pay_minutes/enabled/description/rules）；每周期实例表 `bid_auction_cycle` 属延后期，本期不建。
- 竞价表含 `tenant_id` + BaseDO；`bid_rank/bid_order/bid_order_his` 关联 `auction_id`。
- 通用排序表由 store 模块拥有，表名为 `yshop_store_shop_sort`，含 `tenant_id`、`dept_id`、`business_region_id`、`store_id`、来源标识、排名范围和生效期；不含 `auction_id` 或其他竞价专属字段。
- 出价单 ID String(32)，金额 bigint（分）。
- 破坏性变更含回滚（DROP TABLE + DELETE 菜单/授权）。
- 历史表 `bid_order_his`、结算/退款相关字段不可变。

## 权限 / 数据范围

- 后台 `@PreAuthorize("@ss.hasPermission('bidrank:...')")`；菜单挂 `bidrank` 树，经租户套餐 `menu_ids` 授权售卖。
- 数据权限：商圈/门店范围过滤沿用 `dept_id` + 门店数据权限；查询默认租户隔离。

## 前端消费者同步

- admin（本期）：活动/档位配置菜单与页面，权限码对齐上表。
- admin（延后）：竞拍监控/入围结果页。
- miniapp（延后）：竞价入口/出价/支付页，受租户 feature flag 显隐。
