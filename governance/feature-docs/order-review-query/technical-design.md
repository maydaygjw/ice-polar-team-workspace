# Technical Design: 按订单 ID 查询评价接口

## Module Impact

| 模块 | 影响 |
|------|------|
| `yshop-module-product-biz` | 新增 Mapper 方法、Service 方法、Controller 端点 |

## Key Decisions

1. **复用现有 VO** — 不创建新的响应 VO，直接使用 `AppStoreProductReplyQueryVo`，与现有 page 列表返回结构一致
2. **新增独立 Mapper 方法** — 不在现有 `allReplyList` SQL 上打补丁，新增 `selectByOid` 方法，职责单一
3. **不修改 `/page` 端点** — 现有 page 接口的 `oid` 过滤缺陷作为已知 bug 记录，本 feature 不修复（范围外）

## Implementation Steps

```
StoreProductReplyMapper.java + StoreProductReplyMapper.xml
  └─ 新增 selectByOid(Long oid): List<AppStoreProductReplyQueryVo>

StoreProductReplyService.java
  └─ 新增 getStoreProductReplyListByOrder(Long oid): List<AppStoreProductReplyQueryVo>

StoreProductReplyServiceImpl.java
  └─ 实现新方法，委托 Mapper

StoreProductReplyController.java
  └─ 新增 GET /product/store-product-reply/list-by-order
```

## SQL Design

```sql
SELECT A.product_score, A.service_score, A.comment,
       A.merchant_reply_content, A.merchant_reply_time,
       A.pics, A.create_time,
       B.nickname, B.avatar,
       C.cart_info
FROM yshop_store_product_reply A
  LEFT JOIN yshop_user B ON A.uid = B.id
  LEFT JOIN yshop_store_order_cart_info C ON A.unique = C.unique
WHERE A.oid = #{oid} AND A.deleted = 0
ORDER BY A.create_time DESC
```

## Risk

- 低风险，只读操作，无数据变更
- 新 SQL 结构与现有 `allReplyList` 一致，复用已验证的 JOIN 模式
