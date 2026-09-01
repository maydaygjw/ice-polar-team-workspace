# 测试记录

- backend tests: `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am test` — blocked，既有 `yshop-spring-boot-starter-mq` 测试因 Mockito/Byte Buddy 无法 self-attach 失败，未执行到优惠券模块。
- backend compile: `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am -DskipTests compile -q` — pass。
- admin: `pnpm ts:check` — fail，基线已有大量无关类型错误；优惠券新增 API、按钮、弹窗未出现在新增错误中。
- admin: `pnpm build:prod` — pass；仅有仓库既有 Sass/Vite 弃用警告。
- 手工验收：未执行，需要配置当前租户主小程序和微信接口凭据后验证扫码、复制和下载。
- 场景参数覆盖：已补充 `getType=0` 使用 `couponId`、`getType=1/2` 使用 `cdkey` 的实现；真实微信扫码和兑换状态变更仍待手工验收。
