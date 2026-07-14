# 测试记录 — 普通券与周期券

## 已执行

- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -Dtest=CouponPeriodUtilsTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，3 个周期计算测试通过。
- `pnpm exec eslint src/api/market/discountCoupon/index.ts src/views/market/discountCoupon/DiscountCouponForm.vue src/views/market/discountCoupon/index.vue`：通过，0 error；3 个事件命名 warning 为原有代码 warning。
- `pnpm build:prod`：通过，生成 `dist`。
- 两个 worktree 执行 `git diff --check`：通过。

## 未通过或未完成

- `mvn ... test`：在优惠券模块执行前被既有 `DesensitizeTest.test` 阻断，既有断言期望 `<芋***>`，实际为 `<y****>`，与本特性无关。
- `pnpm ts:check`：被仓库既有类型声明缺失阻断：`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`；生产构建已通过。
- 未执行依赖真实 MySQL/Redis 的接口集成测试；周期领取的数据库唯一索引和事务行为需要部署迁移后验证。
- 已补充周期券只能使用 `getType=0` 的后端约束，尚未执行真实接口请求验证。
- OpenAPI 静态快照未重新生成；当前改动新增优惠券接口字段及周期券 `getType=0` 约束，需在目标环境生成后收集。

## 覆盖范围

`CouponPeriodUtilsTest` 覆盖每日周期、多日周期、发放窗口前后边界。管理端构建和目标文件 lint 已验证；同用户同周期唯一性依赖迁移脚本中的数据库约束。
