# Change Report

## Business result

- 优惠券列表新增“生成二维码”操作。
- 后端按 `getType` 生成对应小程序码：无码券使用 `{coupon_mini_app_page}?couponId={id}`，通用码和一卡一码使用 `{coupon_mini_app_page}?cdkey={code}`。
- 一卡一码从具体兑换码记录生成二维码，并校验兑换码归属当前优惠券且尚未兑换。
- 管理员可在弹窗复制链接并下载二维码。

## Repositories

- `backend`: 新增生成优惠券小程序码接口、按兑换类型分流场景参数、兑换码校验、权限、错误码和升级脚本。
- `admin`: 新增接口调用、列表/兑换码记录入口、二维码弹窗、复制和下载。

## Contracts / migration

- 新增 `GET /admin-api/product/coupon/qrcode/{id}`，权限 `product:coupon:qrcode`。
- 新增 `backend/sql/upgrade-2026-09-01-coupon-qrcode.sql`，仅新增菜单权限，无表结构变更。

## Verification

- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am test`: blocked by the existing Mockito/Byte Buddy self-attach failure in `yshop-spring-boot-starter-mq`; the coupon module was not reached。
- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am -DskipTests compile -q`: pass。
- `pnpm ts:check`: fail due to pre-existing repository-wide type errors；本次新增代码无筛选命中错误。
- `pnpm build:prod`: pass。

## Risks

- 真实二维码生成依赖当前租户已配置并启用主小程序，微信接口与文件存储配置需在测试环境验证；一卡一码还需验证单个兑换码只能兑换一次。

## Suggested PR

`feat(coupon): add coupon mini program QR code generation`
