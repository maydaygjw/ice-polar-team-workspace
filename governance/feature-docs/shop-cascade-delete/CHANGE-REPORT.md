# 店铺删除级联清理

## Summary

- 删除店铺时现在会级联删除其业务配置数据：商品、分类、规格、套餐、评价、桌台、桌台分类、广告图、店铺标签、预约规则/标签、店铺-管理员映射。
- 保留管理员账号本身、历史订单、营收、提现、银行账户、共享规格规则。
- 管理端删除店铺前弹出不可逆级联警告。

## Repositories

- `backend`: 主要变更
- `admin`: 删除确认提示

## Contracts

- N/A: 未新增或修改 HTTP/DB/MQ/权限契约；仅在 `*-api` 模块内部新增跨模块清理接口。

## Verification

- `cd backend && mvn -pl yshop-module-mall/yshop-module-store-biz -am compile -DskipTests`: pass
- `cd backend && mvn -pl yshop-module-mall/yshop-module-store-biz -am test -Dtest=StoreShopServiceImplTest -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false`: pass
- `cd admin && pnpm build:prod`: pass
- 全量 `mvn test` 存在一个既有失败 `DesensitizeTest`，与本次改动无关。

## Risks

- `ShopAdsDO.shopId` 为逗号分隔字符串，已使用边界匹配（eq / likeRight / like / likeLeft）降低误匹配风险；极端多店铺广告（如 "0" 全部店铺）不会被删除。
- 店铺子表（商品规格属性等）无逻辑删除字段，会被物理删除；其余有 `deleted` 字段的表走逻辑删除。

## References

- 需求：删除店铺需级联清理关联对象，前端明确提示用户；管理员不删除。
