# 测试记录

- backend: `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am test` — pass，构建成功，优惠券模块测试 2 项通过。
- backend compile: `mvn -pl yshop-module-marketing/yshop-module-coupon-biz -am -DskipTests compile -q` — pass。
- admin: `pnpm ts:check` — fail，基线已有大量无关类型错误；优惠券新增 API、按钮、弹窗未出现在新增错误中。
- admin: `pnpm build:prod` — pass；仅有仓库既有 Sass/Vite 弃用警告。
- 手工验收：未执行，需要配置当前租户主小程序和微信接口凭据后验证扫码、复制和下载。
