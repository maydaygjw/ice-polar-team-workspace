# 验证记录

## Backend

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-mall/yshop-module-store-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-infra/yshop-module-infra-biz -am -DskipTests compile`：通过。
- `mvn -q -pl yshop-module-mp/yshop-module-mp-biz -am test -DskipTests`：通过，确认后端编译和依赖移除正常。

## Admin

- `pnpm install --frozen-lockfile --ignore-scripts`：通过，仅生成本地依赖目录。
- `pnpm build:dev`：通过，确认 Canvas 编辑器可打包。
- 新增编辑器使用原生 Vue/Canvas 能力，未新增第三方依赖。
- `pnpm ts:check`：未通过，仓库原有 `tsconfig.json` 的 `types` 配置无法解析 `@intlify/unplugin-vue-i18n/types`、`element-plus/global`、`@types/qrcode`、`vite-plugin-svg-icons/client`；未修改基线配置。

## 未执行

- 未连接真实企业微信、OSS、数据库做联调；需要具备 CorpID/Secret、企业微信权限和测试租户。
- 未执行浏览器 E2E；本次 MVP 没有小程序端变更。
