# Review Report: order-review-query

## 变更清单

| 文件 | 变更 |
|------|------|
| `StoreProductReplyMapper.java` | 新增 `selectByOid(Long)` 方法，按 `oid` 查询并 JOIN user/cart_info |
| `StoreProductReplyService.java` | 新增 `getStoreProductReplyListByOrder(Long)` 接口 |
| `StoreProductReplyServiceImpl.java` | 实现新方法，委托 Mapper |
| `StoreProductReplyController.java` | 新增 `GET /list-by-order` 端点 |

## 审查结论

| 维度 | 结果 |
|------|------|
| 正确性 | ✅ — SQL WHERE 条件正确（oid + deleted=0），JOIN 模式与现有查询一致 |
| 安全性 | ✅ — 复用权限码 `product:store-product-reply:query`，无 SQL 注入风险（MyBatis `#{}` 参数化） |
| 兼容性 | ✅ — 仅新增，不修改现有方法签名或行为 |
| 代码风格 | ✅ — 与周围代码风格一致（命名、注释、注解） |

## 验证结果

- `mvn compile` ✅ 通过
- 全量 test ⏭️ 跳过（预存编译问题，与本次变更无关）

## 结论

通过，建议合并。
