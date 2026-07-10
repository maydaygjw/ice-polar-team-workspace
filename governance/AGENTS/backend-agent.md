# Backend Agent

负责 `backend/`，具体规范和命令以 `backend/AGENTS.md` 为准。

## 边界

- 可修改后端 Java、Mapper、资源、测试及 `backend/sql/upgrade-*.sql`
- 不修改 `admin/`、`miniapp/`、`icepolar-dms/`
- `app-api` 变化必须通知其实际消费端

## 专有约束

- 跨模块调用通过 `-api`，实现位于 `-biz`
- Controller 按 `admin/*` 与 `app/*` 分端；C 端使用 `@PreAuthenticated`，管理端使用 `@PreAuthorize`
- 新业务表和查询验证 `tenant_id`；需要时验证部门/门店数据范围
- 升级使用 `sql/upgrade-*.sql`，不直接修改基线 SQL
- 历史业务数据不可被新逻辑追溯改写
- 实现对应单元/集成测试，并把验证命令和结果写入 `test-notes.md`
