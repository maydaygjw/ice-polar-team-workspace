# 验证记录

## 已执行

| 范围 | 命令 | 结果 |
|---|---|---|
| 后端 store/pay 模块编译及同步映射测试 | `mvn -pl yshop-module-mall/yshop-module-store-biz,yshop-module-pay/yshop-module-pay-biz -am -Dtest=ProfitSharingOrderServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test` | 通过；目标模块及依赖编译成功，测试 4/4 通过。 |
| 管理后台生产构建 | `pnpm build:prod` | 最终改动后通过；构建输出提示已有 Browserslist 数据较旧、Sass legacy API 与 `@import` 弃用。 |
| 管理后台类型检查 | `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check` | 全仓检查未通过，共报告 1570 条错误，集中在缺失 API 全局类型、组件类型和既有店铺表单类型推断等。复核后，本次新增绑定 API 和绑定请求/回填代码行无诊断；全仓门禁仍未通过。 |
| 后端空白检查 | `git diff --check` | 通过。 |
| 管理后台空白检查 | `git diff --check` | 通过。 |

第一次并行运行 `pnpm ts:check` 与生产构建时，类型检查进程触发 Node 默认堆内存上限并 OOM；随后提高堆上限单独重跑，确认全仓检查仍被现有大量类型错误阻断。最终生产构建在最后代码修改后重跑通过。本次改动对应的新增 API、绑定保存和回填行没有类型诊断。没有执行真实 AdaPay 请求、数据库迁移或生产环境操作。

## 未执行

- 交互式浏览器 E2E：未连接本地后端、测试租户和 AdaPay 模拟环境；按 `test-plan.md` 保留手工场景。
- Flyway 迁移实库验证：迁移由独立 db-migrator 执行，本次未访问数据库。
