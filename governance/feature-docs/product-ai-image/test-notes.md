# 测试记录

## 已执行

- Backend：`mvn -pl yshop-module-mall/yshop-module-product-biz -am -DskipTests compile` 通过。
- Backend 客户端单元测试：`DashScopeImageClientTest` 1 个用例通过。
- Admin：`pnpm build:prod` 通过。

## 未执行

- Admin `pnpm ts:check` 受仓库现有类型定义配置影响，缺少 `@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`，未归因于本次功能代码。
- 真实百炼和 OSS E2E 未执行，需要测试环境 API Key、模型权限和 master file client OSS 配置；密钥未写入仓库。
