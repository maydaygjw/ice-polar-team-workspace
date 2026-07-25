# 商品选项加价 测试记录

## 编译 / 构建

| 仓库 | 命令 | 结果 |
|---|---|---|
| backend | `mvn clean compile -DskipTests -Dmaven.gitcommitid.skip=true` | BUILD SUCCESS |
| admin | `pnpm build:prod` | PASS（仅预存 Sass `@import` 弃用告警） |

说明：`-Dmaven.gitcommitid.skip=true` 用于跳过 `git-commit-id` 插件；该插件在 git worktree 中无法读取 HEAD（环境问题，与代码无关）。

## 单元测试

| 范围 | 命令 | 结果 |
|---|---|---|
| product-biz | `mvn -pl yshop-module-mall/yshop-module-product-biz surefire:test` | 2 通过，BUILD SUCCESS |
| order-biz | `mvn -pl yshop-module-mall/yshop-module-order-biz surefire:test` | `CommissionServiceImplTest` 17 例 2 失败 3 错误 |

- `CommissionServiceImplTest` 在**未改动的基线 backend** 上运行结果完全相同（17 例 2 失败 3 错误），为预存失败，与本功能无关。
- 全量 `mvn test` 还暴露 framework/system 模块预存失败（`DesensitizeTest`、`TenantServiceImplTest`、`SmsTemplateServiceImplTest`、`MailAccountServiceImplTest`），均与本功能无关。
- 本功能新增的计价/校验/扣库存逻辑（`ProductOptionOrderApiImpl`）暂未新增专项单测。

## admin 校验

| 命令 | 结果 |
|---|---|
| `pnpm ts:check` | 4 个预存 baseline 错误（`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client` type 解析），非本次引入；新增/修改文件 0 类型错误 |
| `pnpm build:prod` | PASS |

## 端到端说明

- 小程序点单页本期不交付，选项下单链路（计价/扣库存/快照）无法由真实 C 端触发，本期以接口级与编译/构建验证为准。
- DB 迁移脚本 `sql/upgrade-2026-07-17-product-option-pricing.sql` 尚未在真实库执行。
