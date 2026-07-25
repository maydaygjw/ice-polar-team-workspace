# 审查报告：店铺删除级联清理

## 结论

实现基本符合需求，建议合并前修复 `ShopAdsDO` 的边界匹配问题。

## 发现

1. **高**：`ShopAdsCleanupApiImpl` / `ShopAdsMapper.deleteByShopId` 原使用 `LIKE '%shopId%'` 会误匹配 `101`/`210` 等。
   - 状态：已修复。改为 `eq` + `likeRight(shopId + ",")` + `like("," + shopId + ",")` + `likeLeft("," + shopId)`。
2. **中**：`StoreShopAdminDO` 原保留未清理；用户明确店铺-管理员映射应随店铺删除，管理员账号本身保留。
   - 状态：已修复，新增 `StoreShopAdminMapper.deleteByShopId` 并在 `StoreShopServiceImpl.deleteShop` 中调用。
3. **中**：`StoreCartShareDO`（购物车分享）也引用 `shop_id`，属于临时会话数据，是否清理未明确。
   - 处理：本次保留，因用户未明确要求，且购物车分享可随订单生命周期自然失效。
3. **低**：`ProductImportBatchDO` 引用 `shop_id`，为导入历史，保留符合审计需求。
4. **低**：`StoreProductDO.shopId` 与 `ProductCategoryDO.shopId` 为 `Integer`，其余多为 `Long`，已实现转换但类型不一致为长期技术债。

## 推荐

- 合并后观察广告图模块是否有全店铺（`shopId = "0"`）场景，确认不会被误删。
- 后续可考虑将 `StoreCartShareDO` 纳入清理范围。
