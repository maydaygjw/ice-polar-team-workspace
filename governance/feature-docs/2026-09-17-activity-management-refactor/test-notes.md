# 活动管理重构验证记录

## 需求阶段

- 已确认活动管理拆分为模板、期次、报名、中奖四个业务模块。
- 已确认报名条件采用开发者扩展接口/注册机制，内置两个企微条件。
- 已确认条件组合只支持 AND。

## 待验证

- 后端活动模块编译、条件处理器单元测试、条件配置迁移测试。
- 菜单迁移后角色权限、租户隔离和部门/商圈数据权限。
- 模板条件保存、停用条件拦截、期次快照不可变和报名失败不落库。
- 两个内置企微条件的成功、失败、数据缺失和外部查询异常。
- 模拟 `ORDER_PLACED_TODAY` 类外部条件的通过、无订单、跨时区日期边界、超时、限流、认证失败、非 2xx、响应不完整、短时缓存隔离和不落报名记录。
- Admin 类型检查、lint、生产构建和四个子模块页面权限。
- H5 条件列表展示、失败原因和报名完整链路。
- API/E2E 场景：AND 组合、历史期次快照、旧 Boolean 字段兼容、未知条件类型、幂等/重复报名。

## 本轮验证

- backend worktree：`mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile`：通过。
- backend worktree：`mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：通过；活动模块暂无测试类，依赖模块测试通过。
- admin worktree：`pnpm install --frozen-lockfile`：通过。
- admin worktree：活动文件 ESLint：通过；`pnpm build:prod`：通过。
- admin worktree：`NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check`：失败；活动相关错误已清零，剩余为既有自动导入/类型错误。
- h5 worktree：`pnpm install --frozen-lockfile`、`pnpm type-check`、`pnpm build`：通过。
- admin/h5 worktree：`node_modules` 仅存在于 worktree，未纳入 Git。

## 预期命令

- `(cd backend && mvn -pl yshop-module-activity/yshop-module-activity-biz -am test)`
- `(cd admin && pnpm ts:check && pnpm lint:eslint && pnpm build:prod)`
- `(cd h5 && pnpm type-check && pnpm build)`
- `(cd governance/e2e && npm test)`
