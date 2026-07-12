# Change Report: 新增按订单 ID 查询评价接口

## Summary

- Admin 端新增 `GET /product/store-product-reply/list-by-order?oid=xxx` 接口，支持按订单 ID 查询该订单下所有商品评价

## Repositories

- `backend`: 新增 Mapper、Service、Controller 方法

## Contracts

- API: 新增端点 `GET /admin-api/product/store-product-reply/list-by-order`，参数 `oid`，返回 `List<AppStoreProductReplyQueryVo>`
- DB: N/A
- MQ: N/A
- 权限: 复用 `product:store-product-reply:query`

## Verification

- `mvn compile -pl yshop-module-mall/yshop-module-product-biz -am`: pass
- 全量 test: skipped（预存问题，非本次变更）

## Risks

- N/A（只读接口，无数据变更，低风险）

## PR

### 标题

```
feat(product): add list-by-order endpoint for store product replies
```

### 正文

```markdown
## Summary
- 新增 `GET /product/store-product-reply/list-by-order?oid={oid}` 接口
- 按订单 ID 查询所有有效评价（含用户昵称/头像、购物车信息、商家回复）

## Repositories
- `backend`: StoreProductReplyMapper, StoreProductReplyService[Impl], StoreProductReplyController

## Contracts
- API: 新增 `GET /admin-api/product/store-product-reply/list-by-order`
- 权限: 复用 `product:store-product-reply:query`

## Verification
- `mvn compile`: pass
- Tests: skipped（预存编译依赖问题，非本次变更引入）
```

## References

- Feature: `governance/feature-docs/order-review-query/`
