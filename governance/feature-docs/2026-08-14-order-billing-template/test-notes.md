# 验证记录 — 订单计费模板与应收应付

## 当前状态

本次增量交付实现计费模板明细手续费承担方配置、单选约束和主体汇总归并；数据库迁移与功能 E2E 仍需在测试环境验证。

| 验证项 | 结果 | 说明 |
|---|---|---|
| 文档结构 | 通过 | 需求、技术设计、契约、UI/UX 与测试计划已分离并完成交叉审校。 |
| Meta YAML 解析 | 通过 | `meta.yaml` 可被 Ruby YAML 解析。 |
| Markdown 行尾空白检查 | 通过 | 本功能文档未发现行尾空白。 |
| Backend pay 模块编译 | 通过 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests compile`。 |
| Backend pay 模块测试 | 基线失败 | 本次改动未引入编译错误；仓库既有 `YuePayServiceTest` 3 个 NPE 和 `ProfitRecipientServiceImplTest` 1 个断言失败。 |
| Admin ESLint（本次文件） | 通过 | `pnpm exec eslint src/api/pay/billingTemplate.ts src/views/finance/billing-template/index.vue`。 |
| Admin 类型检查 | 基线失败 | `pnpm ts:check` 报告仓库既有全局类型、组件和 canvas 模块错误，未出现本次修改文件错误。 |
| E2E | 未执行 | 用例尚未实现。 |

## 实现阶段待记录

- 数据库迁移和回滚验证。
- 金额公式、顺序截断、幂等和重算的单元/集成测试结果。
- API 的认证、权限、租户隔离和业务错误结果。
- 管理端构建、截图与 E2E 结果。
- AdaPay 适配和旧分账数据回归结果。
