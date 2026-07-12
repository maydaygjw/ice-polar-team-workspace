# Review Report: order-review-query

## 变更清单

| 文件 | 变更 |
|------|------|
| `StoreProductReplyMapper.java` | 新增 `selectByOid(Long)` 方法（共用） |
| `AppStoreProductReplyService.java` | 新增 `getReplyListByOrder(Long)` 接口 |
| `AppStoreProductReplyServiceImpl.java` | 实现，委托 `baseMapper.selectByOid` |
| `AppStoreOrderService.java` | 新增 `getReplyListByOrder(Long)` 接口 |
| `AppStoreOrderServiceImpl.java` | 实现，委托 `appStoreProductReplyService` |
| `AppOrderController.java` | 新增 `GET /order/reply/list` 端点 |

## 审查结论

| 维度 | 结果 |
|------|------|
| 正确性 | ✅ — 调用链清晰，SQL JOIN 模式与现有查询一致 |
| 安全性 | ✅ — `@PreAuthenticated` 鉴权，MyBatis `#{}` 防注入 |
| 兼容性 | ✅ — 仅新增，不修改现有方法签名 |
| 代码风格 | ✅ — 与周围代码一致 |

## 验证结果

- `mvn compile` ✅ 通过（product-biz + order-biz 模块）
- 全量 test ⏭️ 跳过（预存问题，非本次变更）

## 结论

通过。
