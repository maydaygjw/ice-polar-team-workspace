# 测试记录：活动模板中奖策略

## Backend

- `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：pass，59 个测试（增加留存唤醒阶段权重测试）。
- 覆盖策略权重、概率归一化、目标/未知阶段、快照和加权不放回抽样。
- `mvn verify -Popenapi -DskipTests`：pass，生成 OpenAPI 快照并收集至 `governance/CONTRACT/backend-api.json`；worktree 下临时跳过 Git 元数据插件后运行，配置已恢复。

## Admin

- `pnpm install --frozen-lockfile`：pass。
- `pnpm build:prod`（Node 堆上限 8 GB）：pass。
- `pnpm ts:check`（Node 堆上限 8 GB）：fail，仓库级类型检查存在大量既有全局声明缺失/全局类型错误；新增 `src/views/activity/index.vue`、`src/api/activity/index.ts` 未出现类型错误。

## Dev 部署验收

- Flyway 测试库迁移：发布前 `info`（运行 94）成功；`migrate`（运行 95）成功；发布后 `info`（运行 96）和 `validate`（运行 97）成功。
- Backend dev2：云效流水线运行 132，状态 `SUCCESS`；PR 合并提交 `0253c411` 已包含在部署来源中。
- Admin dev2：云效流水线运行 52，状态 `SUCCESS`；PR 合并提交 `4e55800a` 已包含在部署来源中。
- 健康检查：Backend `/actuator/health/` 返回 HTTP 200、`UP`；Admin 首页返回 HTTP 200。
- 定向 E2E：`E2E_BASE_URL='https://admin-yshop-dev.holuntech.cn/' npm test -- specs/main/login.spec.ts --grep '空字段提交'`，1 项通过（26.2 秒）。
- 未运行全量 E2E：当前套件默认指向生产环境，且含有硬编码生产地址并会创建真实业务数据的店铺导入流程；`.env.local` 未配置可用于安全执行认证流程的测试账号，因此没有执行全量或登录后的中奖策略 UI 流程。
