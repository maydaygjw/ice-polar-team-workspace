# 商圈排名竞价 — Technical Design

只记录本功能增量。契约细节见 `contract-changes.md`。

> **交付分期**：本期实现 = 模块骨架 + 竞价业务表及 store 通用排序结果表 + admin 活动/档位配置 + 竞价周期管理 + 套餐授权。标注「（延后期）」的小节（出价/结算/退款流程、排序注入、app 侧）随小程序一起交付，本期只保留契约与表结构。

## 模块

新增独立 Maven 模块（保证可单独售卖/下架，不依赖 store 内部实现）：

```
yshop-module-bidrank/
├── yshop-module-bidrank-api    # 竞价模块自身对外 API；不承载 store 排序结果 API
└── yshop-module-bidrank-biz    # controller(admin/app)/service/dal/job/mq
    package co.yixiang.yshop.module.bidrank
```

依赖方向（遵守 `-api` 契约）：`bidrank-biz ──→ store-api`，由 store 模块拥有通用门店排序结果表及读写 API；`store-biz` 不依赖 `bidrank-api`，也不直接依赖 `bidrank-biz`。`bidrank-biz` 另外依赖 `pay-api`（下单/退款）、`store-api`（校验门店/商圈及写入排序结果）。仅 `-biz` 在 `yshop-server` 注册启动。

## 可扩展点（策略化，本期只落默认实现）

| 策略接口 | 默认实现 | 预留 |
|----------|----------|------|
| `AuctionModelStrategy` | `AscendingAuctionStrategy`（分阶段透明升价） | 密封投标 |
| `RankDisplayStrategy` | `RandomInRangeDisplayStrategy`（范围内随机） | 确定性排期 |
| `BidEligibilityRule` | `PerStoreEligibilityRule`（每店独立） | 每商家限一店 |

策略经 `auction_model` / `display_mode` 字段选择，主流程不因新增策略而改。

## 数据模型（5 张竞价表 + 1 张 store 通用排序表）

均含 `tenant_id` 及 `BaseDO` 审计/逻辑删除字段；需部门过滤的含 `dept_id`；`business_region_id` 写入时从门店派生。

### yshop_bid_auction — 竞价活动（周期性模板）
`id(Long) / tenant_id / dept_id / business_region_id / name(活动主题) / enabled(bit,是否启用) / cycle_type(tinyint:1每周 2每月) / anchor_effect_date(date,生效日期锚点) / advance_days(int,提前天数) / start_time(time,启动时间) / duration_minutes(int,活动时长) / pay_minutes(int,支付时间) / deposit_ratio(tinyint=20) / auction_model(tinyint=1) / display_mode(tinyint=1) / description(text,竞拍内容说明) / rules(text,竞拍内容规则)`

- 活动是**周期模板**，实际时间按排期逐周期派生：`生效日期`（由 `cycle_type`+`anchor` 派生）→ `竞拍开始 = 生效日期 − advance_days`（当天 `start_time`）→ `竞拍结束 = 竞拍开始 + duration_minutes`（出价锁定）→ `支付截止 = 竞拍结束 + pay_minutes`（付清全款，未付预付没收）→ 结算后于生效日期生效。
- `下次生效日期` 与每周期运行态/结算结果为派生数据，不落 yshop_bid_auction；由 `yshop_bid_auction_cycle` 承载。
- 约束：`advance_days ≥ 0`；`duration_minutes/pay_minutes > 0`；`deposit_ratio` 1–100。
- 活动可变更性：存在任意周期记录时，活动基本信息、排期、支付/竞拍规则、档位、启停和删除均禁止；只有尚未生成周期的活动可以配置。

### yshop_bid_rank — 排名档位（一活动多档）
`id(Long) / tenant_id / auction_id / rank_start(int) / rank_end(int) / slot_count(int) / start_price(decimal,元) / min_increment(decimal,元) / sort(int)`

约束：`rank_start ≤ rank_end`；`1 ≤ slot_count ≤ rank_end-rank_start+1`。范围可重叠。

### yshop_bid_auction_cycle — 竞价周期实例
`id(Long) / tenant_id / auction_id / business_region_id / effect_date / bid_start_time / bid_end_time / final_pay_deadline / status / BaseDO`

- `status`：0 待开始、1 竞价中、2 可付尾款、3 已结算。
- 周期实例由活动模板派生；生成后保存当时的时间快照，后续活动模板调整不回溯修改已有周期。
- 周期业务去重键为 `tenant_id + auction_id + bid_start_time`；生成和自动开启均须在锁内查询并幂等处理。
- 状态流转为“待开始 → 竞价中 → 可付尾款 → 已结算”，不允许回退；终止操作从竞价中或可付尾款状态逻辑删除。
- 自动或手动进入尾款只修改状态，不修改 `bid_start_time`、`bid_end_time` 或 `final_pay_deadline`；时间字段只由定时任务用于推进自动状态。

### yshop_bid_order — 出价单（订单类，ID String(32)）
`id(String32) / tenant_id / dept_id / business_region_id / auction_id / rank_id / store_id / merchant_id / user_id / bid_price(分) / deposit_amount / deposit_pay_order_id / final_amount / final_pay_order_id / is_winner(bit) / status(tinyint)`

status：0出价中 1被超越 2已付全款 3已作废 4已生效 5已退款。
唯一有效出价：`(auction_id, rank_id, store_id)` 未删除记录唯一（同店在同档位维护单条当前出价，历史入 his）。

### yshop_bid_order_his — 出价历史（只写不改，历史不可变）
`id(Long) / tenant_id / order_id / auction_id / rank_id / store_id / bid_price(分) / action(tinyint: 0出价 1加价 2被超越 3付尾款 4退款) / create_time`

### yshop_store_shop_sort — 通用门店排序结果（store 模块拥有）
`id(Long) / tenant_id / dept_id / business_region_id / store_id / source_code / source_record_id / rank_start(int) / rank_end(int) / effect_start_date / effect_end_date / status(tinyint: 0生效 1失效) / BaseDO`

- 表属于 store 模块，不使用 `bid_` 前缀；表结构和字段不表达竞价、活动或拍卖语义。
- `source_code`、`source_record_id` 是通用来源标识，用于区分竞价、运营置顶或其他排名系统写入的结果；store 模块只负责存储、有效期过滤和对外查询，不解析来源业务。
- `dept_id` 在写入时由门店/商圈派生，供后台部门数据权限使用。
- 同一来源通过 Store Sort API 幂等写入和失效；不由竞价模块直接操作表。

> 只存"该店命中 [rank_start,rank_end]"，**具体位置由门店列表读取时在范围内随机分配**，排序表稳定可对账。表中不保存 `auction_id` 或其他竞价专属字段。

## 周期生命周期（本期）

### 活动变更保护

- 活动更新、档位覆盖、启停和删除接口统一调用 `assertAuctionMutable(auctionId)`。
- 该校验检查当前租户下活动是否存在任意未删除周期；存在记录时返回业务错误 `AUCTION_HAS_CYCLE`，不执行任何写操作。
- 活动变更与周期开启/结束使用同一活动锁，并在事务内再次校验，避免周期刚开启时并发修改活动模板。
- 已生成周期保存活动模板的时间快照；周期结算完成后允许修改活动，修改只影响后续生成周期。

### 生成周期

1. admin 在竞价活动页面点击“生成周期”。
2. admin 可选择下一次、下 2 次或下 3 次；服务按活动的 `cycle_type`、`anchor_effect_date`、`advance_days`、`start_time`、`duration_minutes` 和 `pay_minutes` 计算对应周期时间。
3. 以 `tenant_id + auction_id + bid_start_time` 加分布式锁查询已有周期；已有记录直接返回，不重复创建。
4. 新周期状态为“待开始”，保存活动模板当时的商圈和时间快照。

### 开启周期

- admin 或定时任务只能将“待开始”周期改为“竞价中”；手动开启不判断周期时间。
- 同一活动最多同时保持 3 个“竞价中”周期；手动开启超过上限时拒绝，自动开启达到上限时保留待开始状态，待已有周期结束后再开启。
- 开启前重新获取周期锁并按周期开始时间查询，已存在“竞价中/可付尾款/已结算”记录时直接返回成功，不重复开启。
- 手动开启不修改周期计划时间；定时任务到达 `bid_start_time` 时，如果同一去重键已有已开启周期，则跳过自动生成和开启。

### 进入尾款支付

- admin 在竞价周期页面将“竞价中”周期改为“可付尾款”，立即禁止新出价和加价。
- 定时任务到达 `bid_end_time` 时自动进入“可付尾款”；手动操作不判断时间。
- 可付尾款或已结算周期不能重新开启或重复进入尾款，不回退状态。
- 尾款接口只判断周期是否为“可付尾款”；`final_pay_deadline` 仅供结算定时任务使用。

### 手工结算

- admin 可在“可付尾款”周期页面手工结算，立即执行入围、退款、作废和排序生效。
- 定时任务到达 `final_pay_deadline` 时自动结算；手工结算不判断时间。

### 删除周期

- 仅允许删除“待开始”周期，使用 `BaseDO.deleted` 逻辑删除。
- 竞价中、可付尾款、已结算周期不可用“删除”，确保出价、支付、结算和退款历史可追溯；需要取消时使用“终止”。

### 终止周期

- 终止允许作用于竞价中或可付尾款周期，使用 `BaseDO.deleted` 逻辑删除；待开始周期使用删除操作。
- 终止周期不再接受后续支付，也不会被结算任务查询；已结算周期不可终止。

### 自动开启定时任务

`BidCycleOpenJob` 按活动的周期规则扫描到期计划：

1. 获取活动/计划时间对应的周期锁。
2. 按 `tenant_id + auction_id + bid_start_time` 查询周期。
3. 已有周期且状态为竞价中、可付尾款或已结算：跳过。
4. 已有待开始周期：将其开启为竞价中。
5. 没有周期：按活动模板生成一个周期并直接开启。

任务需要与 admin 的生成/开启接口使用相同的锁和幂等查询，保证手动操作与定时任务并发时最多保留一个周期。

## 关键流程（延后期）

- **出价/加价**：`RedissonLock(auction:rank)` 串行 → 按阶段校验门槛（未满：≥ `start_price` 且 > 自身上次出价+`min_increment`；已满：> 当前最低入围价+`min_increment`）→ 生成/更新 `yshop_bid_order`（预付=出价×ratio，补差额）→ 调 pay-api 下预付单 → 支付回调置"出价中"；出满后被挤出前 `slot_count` 名者置"被超越" → 写 `yshop_bid_order_his`。
- **价格透明度**：`最低入围价` = 该档位有效出价按 `bid_price` 降序第 `slot_count` 名的价（不足 `slot_count` 名即"未满"）。仅"已满"时经 app 接口对外可见；服务端每次出价在锁内实时计算，不落库。
- **尾款**：周期处于“可付尾款”时，商家可支付尾款（全款−预付）→ pay 回调置"已付全款"；接口只按状态判断。
- **结算**：`BidRankSettleJob`（Quartz）扫描状态为“可付尾款”且超过 `final_pay_deadline` 的周期，或由 admin 手工触发结算 → 每档"已付全款"按 `bid_price` 降序取前 `slot_count` 名置"已生效"、经 `StoreShopSortApi` 写入通用排序结果；未中标"已付全款"发退款 MQ；未付清置"已作废"（预付没收，不退）。终止周期因逻辑删除不会被扫描。
- **退款**：`BidRefundConsumer` 消费 RocketMQ，调 pay-api 退全款，回置"已退款"、写 his。
- **失效**：store 模块负责通用排序结果的有效期过滤；竞价模块如需按来源提前失效，经 `StoreShopSortApi` 执行，不直接更新排序表。

## 排序注入（唯一耦合点，延后期）

`store-biz` 的 `AppStoreController` 门店列表：由 store 模块直接查询 `yshop_store_shop_sort` 的有效记录 → 命中店在其档位范围内随机加权前置，其余走默认排序。**无生效数据时短路**，行为与现状一致。store 模块不感知竞价模块，也不按 `source_code` 写死竞价逻辑。

### Store Sort API（跨模块唯一入口）

`store-api` 对外提供通用排序结果能力：

```text
StoreShopSortApi.upsert(StoreShopSortSaveDTO) : Long
StoreShopSortApi.disableBySource(String sourceCode, String sourceRecordId) : void
StoreShopSortApi.listActiveSort(Long businessRegionId) : List<StoreShopSortDTO>
```

竞价模块通过 `sourceCode="bidrank"` 携带自身的来源记录标识调用写入/失效接口；store 模块不解析该值，仅作为隔离和幂等键使用。

## 按模块售卖

- 独立菜单树 `bidrank`（顶级菜单 + 子菜单 + 按钮权限）。
- 售卖＝租户套餐 `system_tenant_package.menu_ids` 勾选；未勾选则后台无入口、`@PreAuthorize` 拦截。
- app 侧租户级 feature flag（系统配置）：未开通租户 miniapp 入口与排序注入短路。

## 迁移/回滚

- SQL：`sql/upgrade-2026-07-22-bidrank-auction.sql`（建 5 张竞价表 + 1 张 store 通用排序表 + 菜单/套餐授权 seed），破坏性变更含回滚。
- 遗留竞价表 → 新竞价表映射见 BACKLOG-005；通用排序结果表由 store 模块拥有；配置金额（起拍价/加价）用 `decimal(10,2)` 元，支付金额（延后期预付/尾款）用 `decimal(10,2)` 元；时间对齐服务端。

## 风险

| 风险 | 缓解 |
|------|------|
| 并发加价一致性 | Redisson 分布式锁 + 出价校验；DB 唯一约束兜底 |
| 支付回调跨截止时刻 | 以支付单完成时间判定入围资格 |
| 财务/历史不可变 | his 与退款记录只写；结算幂等（按 order 状态机） |
| 排序注入影响未购租户 | feature flag + 空数据短路，回退默认排序 |
