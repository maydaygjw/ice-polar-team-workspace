# Requirements Spec: 按订单 ID 查询评价接口

## Scope

新增 App 端 API，支持按订单 ID（`oid`）查询该订单下所有评价记录。

## Use Cases

| # | 场景 | 描述 |
|---|------|------|
| UC-1 | 查看订单评价 | 用户查看已完成订单的评价内容、评分、图片和商家回复 |

## Business Rules

- 评价数据存储在 `yshop_store_product_reply` 表，通过 `oid` 关联 `yshop_store_order.id`
- 一个订单可包含多个购物车商品，每个商品可单独评价，所以一个订单可能有多条评价记录
- 返回结果需包含：评价内容、商品评分、服务评分、评价图片、用户昵称/头像、购物车商品信息、商家回复内容及时间
- 排除软删除的评价记录（`deleted = 0`）

## API Contract

| 属性 | 值 |
|------|-----|
| 模块 | App（小程序/C 端） |
| 方法 | GET |
| 路径 | `/app-api/order/reply/list` |
| 参数 | `oid` (Long, required) — 订单内部 ID |
| 鉴权 | `@PreAuthenticated`（登录即可） |
| 返回 | `CommonResult<List<AppStoreProductReplyQueryVo>>` |

## Edge Cases

- `oid` 不存在：返回空列表，不报错
- `oid` 对应的评价全部已删除：返回空列表

## Acceptance Criteria

- [ ] `GET /app-api/order/reply/list?oid=xxx` 返回该订单所有有效评价
- [ ] 返回字段包含：productScore, serviceScore, comment, pictures, nickname, avatar, cartInfo, merchantReplyContent, merchantReplyTime
- [ ] 无评价时返回空数组
- [ ] 需登录（`@PreAuthenticated`）
- [ ] 编译通过

## Assumptions

- `oid` 是 `yshop_store_order.id`（内部主键），非 `order_id`（外部订单号）
- 复用现有 `AppStoreProductReplyQueryVo` 作为返回 VO，不新建
- 不修改现有 `allReplyList` SQL，新增独立查询方法
