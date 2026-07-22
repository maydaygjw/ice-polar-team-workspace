# 商圈排名竞价（二期）— Technical Design

只记录二期最小实现。契约细节见 `contract-changes.md`；一期表结构和 `StoreShopSortApi` 见 `../bidrank-auction/`。

## 设计目标

先跑通一条可验证链路：

```text
当前周期 → 选择档位并出价 → 同档加价 → 预付 → 尾款 → 简单结算 → StoreShopSortApi → 门店列表展示
```

本期不实现并发抢位、动态竞价和复杂支付状态机。所有“后续补充”都不改变 `yshop_bid_order` 的业务主键和 `yshop_store_shop_sort` 的通用来源字段。

## 模块依赖

```text
bidrank-biz ──→ pay-api
            └─→ store-api

store-biz   ──→ 自身 storesort Mapper/Service
```

- `bidrank-biz` 只通过 `pay-api` 支付/退款，通过 `store-api` 校验门店并写入排序。
- `store-biz` 不依赖 `bidrank-api`，也不直接依赖 `bidrank-biz`。
- 一期保留的 `bidrank-api` 仅作为未来竞价专属 API 容器，本期不新增排序接口。

## 周期实例

新增 `yshop_bid_auction_cycle`，把活动模板派生为可执行的一期实例：

```text
id / tenant_id / auction_id / business_region_id
effect_date / bid_start_time / bid_end_time / final_pay_deadline
status(0待开始 1竞拍中 2已锁定 3已结算) / BaseDO
```

`BidCycleScheduleJob` 每日为启用活动创建当前周期实例。开发环境也允许通过 service 手工创建实例，方便接口测试。

本期只创建当前周期，不预生成未来多周期；周期时间沿用一期规则：

```text
竞拍开始 = effect_date - advance_days + start_time
竞拍结束 = 竞拍开始 + duration_minutes
尾款截止 = 竞拍结束 + pay_minutes
```

## 出价与同档加价

`BidService.bid(cycleId, rankId, storeId, price)`：

1. 查询周期、活动和档位，确认当前时间处于 `[bid_start_time, bid_end_time)`。
2. 调 `StoreShopQueryApi.getShopInfo(storeId)`，校验返回的 `businessRegionId` 等于周期商圈，并调用 `isShopAdmin(storeId, userId)` 校验出价权限。
3. 查询周期下门店已有出价：
   - 不存在：要求 `price >= start_price`，记录本次 `rank_id`；
   - 已存在：要求预付已支付、本次 `rank_id` 与原出价的 `rank_id` 一致，且 `price > current_bid_price + min_increment`；
   - 如果尝试切换到其他档位，直接拒绝。
4. 首次出价创建 `yshop_bid_order`；后续加价更新同一出价单的 `bid_price`，并新增一条 `yshop_bid_order_his`。
5. 当前出价的预付金额 = `bid_price × deposit_ratio`；首次出价支付全额预付，后续加价只支付预付差额。
6. 调 `PayOrderApi.createPayOrder(bidOrderId, depositDelta, "bidrank")`，返回本次支付参数。

本期不加 Redisson 锁；并发重复请求的行为不作为一致性保证，数据库唯一约束或业务异常即可。本期不计算实时最低入围价，也不提供实时价格栈。

## 两段支付

### 预付

- 预付成功通知到达后，记录 `deposit_paid=true` 和已支付金额。
- 预付未成功的出价单不能支付尾款，也不能参与结算。

### 尾款

- `final-pay` 只接受已完成预付、当前时间未超过 `final_pay_deadline` 的出价单。
- 尾款金额：`bid_price - deposit_amount`，按最新一次成功出价计算。
- 尾款支付成功后设置 `status=2（已付全款）` 和 `final_pay_time`。

支付渠道和支付参数由 pay 模块处理，bidrank 只拿到支付参数并返回给客户端。

## 结算

`BidRankSettleJob` 每分钟扫描 `final_pay_deadline` 已过且 `status != 3` 的周期：

1. 每个档位查询 `status=2` 的出价单。
2. 按 `bid_price DESC, final_pay_time ASC, id ASC` 排序，取前 `slot_count` 个。
3. 中标单设置 `status=4（已生效）`。
4. 对每个中标单调用：

   ```text
   StoreShopSortApi.upsert(
       businessRegionId,
       storeId,
       sourceCode="bidrank",
       sourceRecordId=String.valueOf(cycleId),
       rankStart,
       rankEnd,
       effectStartDate=effectDate,
       effectEndDate=下一周期生效日前一天
   )
   ```

5. 其他已付全款单发送 `bidrank_refund`；已付预付但未付尾款的单只退预付；未付预付的单直接设置 `status=3（已作废）`。
6. 周期设置 `status=3（已结算）`。

本期结算只按一次任务执行的简单流程设计；不设计重复调度、跨节点抢占、退款重试和对账补偿。

## 排序注入

门店列表继续由 `store-biz` 读取自己拥有的 `yshop_store_shop_sort`：

1. 查询商圈当前有效记录。
2. 按 `rankStart/rankEnd` 在范围内随机放置命中的门店。
3. 其他门店维持原默认排序。

store 不识别 `source_code=bidrank` 的业务含义，也不依赖 bidrank 模块。有效期由通用排序查询过滤，无需竞价模块单独维护过期 Job。

## 支付通知与退款

- pay 回调继续发布 Redis Stream `order.pay.notice`。
- 消息增加通用 `bizType`，竞价支付为 `bidrank`；bidrank 消费者只处理该类型。
- 预付通知更新预付字段，尾款通知更新 `status=2/final_pay_time`。
- 结算任务直接调用 `PayOrderApi.refund`；本期不单独增加退款消息消费者。
- 本期失败只保留失败记录和日志，不实现自动重试、对账和人工补偿。

## Admin 查询

只实现两个查询：

- 出价单分页：按周期、商圈、门店、状态筛选。
- 周期结果：展示档位、门店和最终状态；退款失败只记录日志，不在本期增加独立退款状态字段。

不实现实时价格栈、最低入围价、人工改价和人工改中标结果。

## 数据模型变化

### yshop_bid_auction_cycle

新增周期实例表，唯一键为 `(auction_id, effect_date)`。

### yshop_bid_order

二期增加：

```text
cycle_id       bigint       当前周期
final_pay_time datetime     尾款支付完成时间
```

当前出价唯一键调整为 `(cycle_id, store_id)`；首次选择的 `rank_id` 固定，后续只能更新价格。`auction_id` 继续保留，便于查询和历史兼容。

### pay_out_order_no

增加 `biz_type varchar(16) default 'store_order'`，仅用于支付通知业务分流；不增加渠道专属字段。

### 排序结果

不新增、不修改排序表，使用一期的 `yshop_store_shop_sort`。竞价只通过 `StoreShopSortApi` 写入。

## 迁移与回滚

升级脚本：`sql/upgrade-2026-07-22-bidrank-auction-phase2.sql`。

- 新建 `yshop_bid_auction_cycle`。
- 给 `yshop_bid_order` 增加 `cycle_id`、`final_pay_time` 并调整唯一约束为 `(cycle_id, store_id)`。
- 给 `pay_out_order_no` 增加 `biz_type`。
- 增加 admin 监控/结果菜单和 `bidrank:order:query` 权限。
- 回滚按相反顺序删除字段、索引、周期表和菜单。

## Phase3 待办

### P0：先补核心正确性

1. **并发与幂等**：按 `cycleId + rankId` 增加分布式锁；增加客户端请求幂等号；明确重复出价、重复支付通知和重复结算的返回/状态转换。
2. **真实竞价**：在基础同档加价之上增加锁内最低入围价、`/rank/status`、价格栈和更严格的同价排序规则。
3. **结算状态机**：把周期、出价、支付、退款拆成可重入状态；结算重跑不重复中标、不重复写排序、不重复退款。
4. **退款可靠性**：增加退款状态、重试次数、下一次重试时间、对账结果和 admin 手工补偿入口。

### P1：补齐运营与支付能力

1. **周期运营**：提前生成多个周期；支持暂停/重开；活动和档位在周期开始后冻结；支持结算重跑。
2. **租户开关**：接入套餐菜单/feature flag；租户关闭后停止新出价，并按来源撤回未生效排序结果。
3. **支付可靠性**：完善 `bizType` 全链路传递、回调乱序处理、支付单来源追踪、渠道差异适配和对账告警。
4. **运营审计**：记录配置变更、周期操作、手工补偿和结果撤回的操作人及原因。

### P2：补齐产品体验与工程质量

1. **小程序端**：活动/档位、实时价格、出价、支付、订单和异常提示页面。
2. **Admin 端**：实时竞争监控、价格栈、退款失败处理、结算重跑和审计记录查看。
3. **质量保障**：并发压测、支付沙箱、回调乱序/重复测试、结算故障恢复测试和退款告警。
4. **可观测性**：出价成功率、支付转化率、结算耗时、退款失败率和排序写入失败率指标。
