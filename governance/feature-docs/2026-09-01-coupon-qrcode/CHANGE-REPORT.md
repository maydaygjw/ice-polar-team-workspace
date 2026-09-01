# Change Report

## Business result

- 优惠券列表新增“生成二维码”操作。
- 后端按当前租户的主小程序生成 `/home/index/index?couponId={id}` 对应的小程序码。
- 管理员可在弹窗复制链接并下载二维码。

## Repositories

- `backend`: 新增生成优惠券小程序码接口、权限、错误码和升级脚本。
- `admin`: 新增接口调用、列表按钮、二维码弹窗、复制和下载。

## Contracts / migration

- 新增 `GET /admin-api/product/coupon/qrcode/{id}`，权限 `product:coupon:qrcode`。
- 新增 `backend/sql/upgrade-2026-09-01-coupon-qrcode.sql`，仅新增菜单权限，无表结构变更。

## Verification

- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am test`: pass。
- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am -DskipTests compile -q`: pass。
- `pnpm ts:check`: fail due to pre-existing repository-wide type errors；本次新增代码无筛选命中错误。
- `pnpm build:prod`: pass。

## Risks

- 真实二维码生成依赖当前租户已配置并启用主小程序，微信接口与文件存储配置需在测试环境验证。

## Suggested PR

`feat(coupon): add coupon mini program QR code generation`
