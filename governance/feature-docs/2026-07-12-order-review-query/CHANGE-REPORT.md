# Change Report: 新增按订单 ID 查询评价接口（App API）

## Summary

- App 端新增 `GET /app-api/order/reply/list?oid=xxx` 接口
- 小程序/C 端用户可查看已完成订单的评价详情（评分、内容、图片、商家回复）

## Repositories

- `backend`: AppStoreProductReplyService[Impl], AppStoreOrderService[Impl], AppOrderController, StoreProductReplyMapper

## Contracts

- API: `GET /app-api/order/reply/list`，参数 `oid`，返回 `List<AppStoreProductReplyQueryVo>`
- DB: N/A
- MQ: N/A
- 鉴权: `@PreAuthenticated`（登录即可）

## Verification

- `mvn compile`: pass
- Tests: skipped（预存问题）

## Risks

- N/A

## PR

### 标题

```
feat(order): add GET /order/reply/list for app-side review query
```

### 正文

```markdown
## Summary
- 新增 `GET /app-api/order/reply/list?oid={oid}` 接口
- 小程序端可直接查看订单评价（评分、内容、图片、商家回复）

## Repositories
- `backend`: AppStoreProductReplyService, AppStoreOrderService, AppOrderController, StoreProductReplyMapper

## Contracts
- API: `GET /app-api/order/reply/list`
- 鉴权: `@PreAuthenticated`

## Verification
- `mvn compile`: pass
```

## References

- Feature: `governance/feature-docs/2026-07-12-order-review-query/`
- Gitee PR: #50
