# Technical Design: 按订单 ID 查询评价接口

## Module Impact

| 模块 | 影响 |
|------|------|
| `yshop-module-product-biz` | 新增 Mapper 方法 `selectByOid`；AppStoreProductReplyService 新增查询方法 |
| `yshop-module-order-biz` | AppStoreOrderService + AppOrderController 新增端点 |

## Key Decisions

1. **App 端而非 Admin 端** — 接口供小程序/C 端用户查看已评价订单，使用 `@PreAuthenticated` 鉴权
2. **复用现有 VO** — 不创建新的响应 VO，使用 `AppStoreProductReplyQueryVo`
3. **通过 AppStoreOrderService 调用** — 保持 `/order` 路由下所有操作统一经过 order service

## Call Chain

```
AppOrderController (GET /order/reply/list)
  → AppStoreOrderService.getReplyListByOrder(oid)
    → AppStoreProductReplyService.getReplyListByOrder(oid)
      → StoreProductReplyMapper.selectByOid(oid)
        → SQL JOIN yshop_user + yshop_store_order_cart_info
```

## Risk

- 低风险，只读操作，无数据变更
