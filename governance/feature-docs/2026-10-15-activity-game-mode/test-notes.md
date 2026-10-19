# 验证记录

## 构建与类型检查

- Backend：`mvn -pl yshop-module-activity/yshop-module-activity-biz -am -DskipTests compile` — 通过。未执行测试。
- H5：`pnpm build` — 通过（包含 `vue-tsc --noEmit` 与 Vite production build）。
- Admin：`pnpm install --frozen-lockfile` — 通过；`pnpm build:prod` — 通过。`NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check` 全量检查仍失败，报告仓库既有的全局类型/组件错误；本次涉及的 `src/api/activity/index.ts`、`src/views/activity/index.vue`、`src/views/activity/period/index.vue` 无类型错误。
- 三个 worktree 的 `git diff --check` — 通过。

## 范围外验证

- 未运行单元、集成或端到端测试。
- 未连接数据库验证迁移脚本。部署前需在目标数据库版本执行增量 SQL，并确认已有模板奖品、历史期次与新唯一索引兼容。
- 未在浏览器中完成管理端配置、活动报名、三关终局派奖和兑奖完整链路。

## 测试环境部署状态

- backend/admin/h5 功能分支已分别提交并推送，云效测试流水线当前默认源分支分别是 `master`、`master`、`main`；流水线支持 `runningBranchs` 显式指定源分支。
- 尚未触发自动部署流水线。后端依赖本功能 SQL 迁移，而当前测试环境没有可用数据库密码；从本机进行的只读数据库连通性检查被 MySQL 拒绝。数据库迁移按[部署与交接手册](../../PLAYBOOKS/deployment.md)单独执行，不能假定应用部署会自动执行。
- 在测试库迁移完成并确认后，再按流水线部署 backend、admin、h5，记录 run ID 并执行健康及端到端验收。

## 已检查行为

- H5 线下兑奖仅展示“请联系企业微信客服兑奖”提示，不渲染兑奖按钮。
- 游戏进行中不会发奖；失败或第 3 关通过时按最高通过关结算；第 1 关失败不产生中奖记录。
- 关卡状态和顺序由后端校验；H5 报告是否通过。报名行锁、requestId 响应缓存用于防止重复推进与重复派奖。
