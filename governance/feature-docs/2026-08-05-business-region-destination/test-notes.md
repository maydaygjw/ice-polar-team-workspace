# 测试记录：商圈目的地维护

## Backend

- `mvn -pl yshop-module-mall/yshop-module-store-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-mall/yshop-module-store-biz -am -Dtest=BusinessRegionDestinationServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，2 个用例。

## Admin

- `pnpm exec prettier --check ...`：通过。
- 定向 `pnpm exec eslint ...`：通过。
- `pnpm build:prod`：通过。
- `pnpm ts:check`：未通过，工作区现有 `tsconfig` 引用的四个类型入口无法从当前依赖树解析：`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`；未出现本次新增文件的类型诊断。

## E2E

- 未执行；本功能未启用复杂 E2E，真实地图选择和权限隔离仍需在测试环境通过浏览器验收。
