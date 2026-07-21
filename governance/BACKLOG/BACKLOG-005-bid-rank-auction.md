# Backlog Item: 商圈排名竞价

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-005 |
| Title | 商圈排名竞价 |
| Status | `draft` |
| Priority | `P1` |
| Created | 2026-07-21 |
| Author | gejunwen |
| Tags | bid, rank, store, region, commercial |

## Problem / Need

平台目前没有商业化排名机制，商圈内店铺在小程序首页的展示顺序完全由默认规则决定，平台无法从排名展示位中获得收入。

需要在商圈维度引入排名竞价能力：
- 平台运营方可按商圈配置排名竞价活动，设定排名位次、起拍价、竞拍时间等规则
- 商家可对自己店铺所在商圈的排名位次出价竞拍
- 竞拍结束后系统按价格优先规则锁定入围订单，商家支付尾款后生效
- 排名在生效周期内按规则展示，出价高者获得更好的曝光位次

这是从遗留系统（饭火轮 PHP 后端）迁移的已知功能，源逻辑位于 `addons/hlmall/` 下（`editbidrank`、`bidauction`、`bidrankorder`、`wxapp.php` 相关接口、`auction_rank_sort` 定时任务）。

## Context

- 遗留系统使用 5 张表：`ims_bid_auction`、`ims_bid_rank`、`ims_bid_order`、`ims_bid_order_his`、`ims_bid_shopsort`
- 竞拍模型为公开 ascending auction（价格栈），出价时扣 20% 预付款，入围后支付尾款
- 排名生效通过每日 23:59 定时任务将店铺写入排序表，小程序默认排序优先读取竞价结果
- 迁移到新系统需对齐多租户模型（tenant_id）、新 RBAC 权限体系、Quartz 定时任务、RocketMQ 异步退款
- 详细现状分析见需求文档（由遗留代码逆向工程产出）

## Acceptance Criteria

待产品澄清后补充。关键待确认问题：
- 排名区间是否允许重叠
- 竞拍模型是否沿用公开竞价还是改为密封投标
- 显示天数比例的概率机制是否改为确定性排期
- 同一商家多店铺是否分别允许出价
