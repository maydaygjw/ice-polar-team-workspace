# Site Order Status Remap — Test Notes

## Backend

| Command | Result | Notes |
|---------|--------|-------|
| `mvn compile -pl yshop-module-site/yshop-module-site-biz -am` | ✅ PASS | Enum + Service 编译通过 |
| `mvn test -pl yshop-module-site/yshop-module-site-biz -am` | ⚠️ SKIPPED | 前置 module `yshop-spring-boot-starter-web` 存在 1 个预存测试失败 (`DesensitizeTest.test`)，非本次变更引起 |

## Admin Frontend

| Command | Result | Notes |
|---------|--------|-------|
| `pnpm ts:check` | ⚠️ SKIPPED | 缺少 `@types/qrcode`, `element-plus/global`, `vite-plugin-svg-icons/client` 类型定义，预存问题，非本次变更引起 |
| `pnpm build:prod` | ✅ PASS | 生产构建成功，dist 目录正常生成 |

## Summary

- 本次变更的 2 个仓库编译/构建均通过
- 所有失败项均为预存问题，非本次 status remap 引起
- 确认无 `PENDING_SERVICE` 残留引用
