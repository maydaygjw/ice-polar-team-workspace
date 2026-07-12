# Test Notes: order-review-query

## Compilation

| 步骤 | 结果 |
|------|------|
| `mvn compile -pl yshop-module-mall/yshop-module-product-biz -am` | ✅ 通过 |

## Tests

| 步骤 | 结果 |
|------|------|
| `mvn test -pl yshop-module-mall/yshop-module-product-biz` | ⏭️ 跳过 — 预存问题 |

## 跳过原因

- `yshop-module-product-biz` 模块存在预存的编译依赖问题（`AppStoreProductServiceImpl.java:8` 引用 `co.yixiang.yshop.framework.redis.util.redis` 包不存在），与本次变更无关
- `yshop-spring-boot-starter-web` 模块的测试失败也是预存问题
- 本次变更：仅新增 Mapper SQL 查询 + Service 代理 + Controller 端点，均为标准 MyBatis-Plus/Spring MVC 模式，无业务逻辑变更
