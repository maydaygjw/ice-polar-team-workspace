# 订单结算管理商圈筛选契约

## 目标

订单结算管理列表可按商圈过滤结算记录。

## API

- `GET /admin-api/order/store-order/settlement-page` 增加可选 `businessRegionId`（Long）查询参数。
- 参数有值时，仅返回当前租户下 `yshop_store_shop.business_region_id` 等于该值、且 `yshop_store_shop.id` 匹配结算记录 `shop_id` 的记录。
- 店铺和结算记录关联同时校验租户 ID；商圈为空时保持现有查询结果和行为。
- 现有 `shopId` 条件继续有效。若同时传商圈和店铺 ID，结果须同时符合两个条件。
- 响应结构、分页排序、状态映射和结算快照均不变。

## 管理后台

- 订单结算管理筛选栏新增商圈下拉框，选项来自现有商圈 simple-list 接口。
- 查询时传递 `businessRegionId`；重置筛选时清空该参数。

## 边界

- 不变更数据库结构。
- 不修改已保存的应收应付或分账快照。
- 查询继续受当前租户过滤约束。
