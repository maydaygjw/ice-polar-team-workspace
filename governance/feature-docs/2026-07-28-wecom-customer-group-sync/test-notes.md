# 测试记录

## 已执行

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests test`：通过，完成包含新增测试的测试源码编译。
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -Dtest=WecomConvertTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，2 个测试通过。
- `pnpm exec eslint src/api/mp/wecom/account.ts src/api/mp/wecom/customerGroup.ts src/views/mp/wecom/account/index.vue src/views/mp/wecom/account/AccountForm.vue src/views/mp/wecom/customerGroup/index.vue`：通过。
- `pnpm exec prettier --check src/api/mp/wecom/account.ts src/api/mp/wecom/customerGroup.ts src/views/mp/wecom/account/index.vue src/views/mp/wecom/account/AccountForm.vue src/views/mp/wecom/customerGroup/index.vue`：通过（格式化后复核）。
- `pnpm build:prod`：通过；仅有既有 Sass/Vite 弃用警告。
- `git diff --check`：backend/admin worktree 均通过。

## 未通过或未执行

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`：未通过，失败发生在既有 `yshop-spring-boot-starter-web` 的 `DesensitizeTest`，当前环境实际为 `y****`、基线期望为 `芋***`；未进入本功能测试。
- `pnpm ts:check`：当前仓库基线的 `tsconfig.json` 类型入口无法解析 `@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global` 和 `vite-plugin-svg-icons/client`，未产生本功能源码诊断；同一 worktree 的生产构建和变更文件 ESLint 已通过。
- 未执行真实企业微信 API 测试：没有测试 CorpID/Secret，且本地 backend、MySQL、Redis 服务未启动。
- 未执行 Playwright E2E：没有可用的登录测试环境和企业微信测试配置，且同步会产生外部接口副作用。
- 未重新生成 `governance/CONTRACT/backend-api.json`：OpenAPI 生成命令要求本地 MySQL、Redis 和 8888 服务，当前端口均不可用；新增接口语义已记录于 `contract-changes.md`。

## 覆盖的验收点

- 转换测试覆盖业务字符串保持原值、Secret 仅在响应中脱敏，防止 MapStruct 将脱敏逻辑误用于名称/CorpID/群字段。
- 编译覆盖新增 Controller、VO、DO、Mapper、Service、企业微信 API client 和加密字段映射。
- 生产构建覆盖管理端动态菜单组件路径对应的页面编译。
