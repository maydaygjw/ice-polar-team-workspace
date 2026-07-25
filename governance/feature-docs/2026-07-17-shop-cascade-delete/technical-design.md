# 技术设计：店铺删除级联清理

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-store-biz` | 修改 | `StoreShopServiceImpl.deleteShop` 增加事务与级联清理调用。 |
| `yshop-module-store-biz` | 修改 | `StoreShopWriteApiImpl.deleteShop` 委托给 `StoreShopService`。 |
| `yshop-module-product-api` | 新增 | `ProductCleanupApi` 接口。 |
| `yshop-module-product-biz` | 新增 | `ProductCleanupApiImpl` 实现。 |
| `yshop-module-desk-api` | 新增 | `ShopDeskCleanupApi` 接口。 |
| `yshop-module-desk-biz` | 新增 | `ShopDeskCleanupApiImpl` 实现。 |
| `yshop-module-shop-api` | 新增 | `ShopAdsCleanupApi` 接口。 |
| `yshop-module-shop-biz` | 新增 | `ShopAdsCleanupApiImpl` 实现。 |
| `admin` | 修改 | 店铺列表删除确认弹窗与 i18n。 |

## 关键决策

1. **跨模块调用走 `*-api`**
   - `store-biz` 仅依赖 `product-api`、`desk-api`、`shop-api`，不依赖其他模块的 `*-biz`，避免循环依赖和破坏模块边界。
2. **清理顺序**
   - 先清理子模块数据，再清理店铺自身；同一模块内先子表后父表。
   - 顺序：Product → Desk → Ads → StoreTagRef/ShopDueRule/ShopDueLabel/StoreShopAdmin → StoreShop。
3. **逻辑删除 vs 物理删除**
   - 继承 `BaseDO` 且有 `@TableLogic` 的表走逻辑删除。
   - 商品规格属性/值/结果、套餐组/明细等无 `deleted` 字段的子表走物理删除。
4. **管理员与映射处理**
   - 管理员账号本身保留。
   - 店铺-管理员映射（`yshop_store_shop_admin`）随店铺删除走逻辑删除。
5. **历史/财务数据不删除**
   - 不清理订单、营收、提现、银行账户、导入批次。

## 类型处理

- `StoreProductDO.shopId` 与 `ProductCategoryDO.shopId` 为 `Integer`，清理时从 `Long` 转为 `Integer`。
- `ShopAdsDO.shopId` 为逗号分隔 `String`，使用精确边界匹配避免 `LIKE '%5%'` 误匹配 `15`/`50`。

## 接口设计

```java
public interface ProductCleanupApi {
    void deleteByShopId(Long shopId);
}

public interface ShopDeskCleanupApi {
    void deleteByShopId(Long shopId);
}

public interface ShopAdsCleanupApi {
    void deleteByShopId(Long shopId);
}
```

## 事务边界

- `StoreShopServiceImpl.deleteShop` 标注 `@Transactional(rollbackFor = Exception.class)`，所有清理操作在同一事务中回滚。

## 风险与回滚

- 风险：商品规格属性表物理删除后无法恢复；但店铺删除本身为不可逆操作，符合预期。
- 回滚：事务失败时所有逻辑删除/物理删除均回滚，店铺记录保持不变。
