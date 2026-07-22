# 商圈排名竞价 — Technical Design

只记录本功能增量。契约细节见 `contract-changes.md`。

> **交付分期**：本期实现 = 模块骨架 + 5 表 + admin 活动/档位配置 + 套餐授权。标注「（延后期）」的小节（出价/结算/退款流程、排序注入、app 侧）随小程序一起交付，本期只保留契约与表结构。

## 模块

新增独立 Maven 模块（保证可单独售卖/下架，不侵入 store）：

```
yshop-module-bidrank/
├── yshop-module-bidrank-api    # BidRankSortApi + DTO：供 store 模块查排序结果
└── yshop-module-bidrank-biz    # controller(admin/app)/service/dal/job/mq
    package co.yixiang.yshop.module.bidrank
```

依赖方向（遵守 `-api` 契约）：`store-biz ──→ bidrank-api`；`bidrank-biz` 不反向依赖 store 内部。`bidrank-biz` 依赖 `pay-api`（下单/退款）、`store-api`（校验门店/商圈）。仅 `-biz` 在 `yshop-server` 注册启动。

## 可扩展点（策略化，本期只落默认实现）

| 策略接口 | 默认实现 | 预留 |
|----------|----------|------|
| `AuctionModelStrategy` | `AscendingAuctionStrategy`（分阶段透明升价） | 密封投标 |
| `RankDisplayStrategy` | `RandomInRangeDisplayStrategy`（范围内随机） | 确定性排期 |
| `BidEligibilityRule` | `PerStoreEligibilityRule`（每店独立） | 每商家限一店 |

策略经 `auction_model` / `display_mode` 字段选择，主流程不因新增策略而改。

## 数据模型（5 表，`bid_` 前缀）

均含 `tenant_id` 及 `BaseDO` 审计/逻辑删除字段；需部门过滤的含 `dept_id`；`business_region_id` 写入时从门店派生。

### bid_auction — 竞价活动（周期性模板）
`id(Long) / tenant_id / dept_id / business_region_id / name(活动主题) / enabled(bit,是否启用) / cycle_type(tinyint:1每周 2每月) / anchor_effect_date(date,生效日期锚点) / advance_days(int,提前天数) / start_time(time,启动时间) / duration_minutes(int,活动时长) / pay_minutes(int,支付时间) / deposit_ratio(tinyint=20) / auction_model(tinyint=1) / display_mode(tinyint=1) / description(text,竞拍内容说明) / rules(text,竞拍内容规则)`

- 活动是**周期模板**，实际时间按排期逐周期派生：`生效日期`（由 `cycle_type`+`anchor` 派生）→ `竞拍开始 = 生效日期 − advance_days`（当天 `start_time`）→ `竞拍结束 = 竞拍开始 + duration_minutes`（出价锁定）→ `支付截止 = 竞拍结束 + pay_minutes`（付清全款，未付预付没收）→ 结算后于生效日期生效。
- `下次生效日期` 与每周期运行态/结算结果为派生数据，不落 bid_auction；由 `bid_auction_cycle`（**延后期**新增）承载，本期不建。
- 约束：`advance_days ≥ 0`；`duration_minutes/pay_minutes > 0`；`deposit_ratio` 1–100。

### bid_rank — 排名档位（一活动多档）
`id(Long) / tenant_id / auction_id / rank_start(int) / rank_end(int) / slot_count(int) / start_price(decimal,元) / min_increment(decimal,元) / sort(int)`

约束：`rank_start ≤ rank_end`；`1 ≤ slot_count ≤ rank_end-rank_start+1`。范围可重叠。

### bid_order — 出价单（订单类，ID String(32)）
`id(String32) / tenant_id / dept_id / business_region_id / auction_id / rank_id / store_id / merchant_id / user_id / bid_price(分) / deposit_amount / deposit_pay_order_id / final_amount / final_pay_order_id / is_winner(bit) / status(tinyint)`

status：0出价中 1被超越 2已付全款 3已作废 4已生效 5已退款。
唯一有效出价：`(auction_id, rank_id, store_id)` 未删除记录唯一（同店在同档位维护单条当前出价，历史入 his）。

### bid_order_his — 出价历史（只写不改，历史不可变）
`id(Long) / tenant_id / order_id / auction_id / rank_id / store_id / bid_price(分) / action(tinyint: 0出价 1加价 2被超越 3付尾款 4退款) / create_time`

### bid_shop_sort — 排序结果（Job 写，store 读）
`id(Long) / tenant_id / business_region_id / auction_id / store_id / rank_start(int) / rank_end(int) / effect_start_date / effect_end_date / status(tinyint: 0生效 1失效)`

> 只存"该店命中 [rank_start,rank_end]"，**具体位置由门店列表读取时在范围内随机分配**，排序表稳定可对账。

## 关键流程（延后期）

- **出价/加价**：`RedissonLock(auction:rank)` 串行 → 按阶段校验门槛（未满：≥ `start_price` 且 > 自身上次出价+`min_increment`；已满：> 当前最低入围价+`min_increment`）→ 生成/更新 bid_order（预付=出价×ratio，补差额）→ 调 pay-api 下预付单 → 支付回调置"出价中"；出满后被挤出前 `slot_count` 名者置"被超越" → 写 his。
- **价格透明度**：`最低入围价` = 该档位有效出价按 `bid_price` 降序第 `slot_count` 名的价（不足 `slot_count` 名即"未满"）。仅"已满"时经 app 接口对外可见；服务端每次出价在锁内实时计算，不落库。
- **尾款截止**：每周期 `支付截止` 后出价锁定，商家在支付截止前付尾款（全款−预付）→ pay 回调置"已付全款"。
- **结算**：`BidRankSettleJob`（Quartz）扫描到期周期 → 每档"已付全款"按 `bid_price` 降序取前 `slot_count` 名置"已生效"、写 bid_shop_sort；未中标"已付全款"发退款 MQ；未付清置"已作废"（预付没收，不退）。
- **退款**：`BidRefundConsumer` 消费 RocketMQ，调 pay-api 退全款，回置"已退款"、写 his。
- **失效**：`BidSortExpireJob` 将过期 bid_shop_sort 置失效。

## 排序注入（唯一耦合点，延后期）

`store-biz` 的 `AppStoreController` 门店列表：查 `BidRankSortApi.listActiveSort(regionId)` → 命中店在其档位范围内随机加权前置，其余走默认排序。**模块未授权/无生效数据时短路**，行为与现状一致。

## 按模块售卖

- 独立菜单树 `bidrank`（顶级菜单 + 子菜单 + 按钮权限）。
- 售卖＝租户套餐 `system_tenant_package.menu_ids` 勾选；未勾选则后台无入口、`@PreAuthorize` 拦截。
- app 侧租户级 feature flag（系统配置）：未开通租户 miniapp 入口与排序注入短路。

## 迁移/回滚

- SQL：`sql/upgrade-2026-07-22-bidrank-auction.sql`（建 5 表 + 菜单/套餐授权 seed），破坏性变更含回滚。
- 遗留 5 表 → 新 5 表映射见 BACKLOG-005；配置金额（起拍价/加价）用 `decimal(10,2)` 元，支付金额（延后期预付/尾款）用 `decimal(10,2)` 元；时间对齐服务端。

## 风险

| 风险 | 缓解 |
|------|------|
| 并发加价一致性 | Redisson 分布式锁 + 出价校验；DB 唯一约束兜底 |
| 支付回调跨截止时刻 | 以支付单完成时间判定入围资格 |
| 财务/历史不可变 | his 与退款记录只写；结算幂等（按 order 状态机） |
| 排序注入影响未购租户 | feature flag + 空数据短路，回退默认排序 |
