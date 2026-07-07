# 创建工程团队

分析功能需求，从 `governance/AGENTS/` 组建团队，按阶段推进需求、设计、实现、测试、审查和交付。

本 prompt 是**交付编排器**：负责读上下文、选 Agent、执行门禁、同步状态、产出报告、等待用户确认。专业产物由对应 Agent 完成。

## 适用范围
适用于正式功能交付：新功能、跨端改动、跨仓库改动、契约变更、UI/UX 改动、需要测试审查和 PR 的任务。
不适用于：单文件热修、纯咨询、纯 review、临时实验。

## 全局规则

1. 所有命令从工作区根执行；进入子仓库使用 `(cd subdir && cmd)`。
2. 开始前读取 `governance/CLAUDE.md`、`governance/ARCHITECTURE.md`、相关 `governance/ADR/`、目标仓库 `AGENTS.md`。
3. API、DB、MQ、依赖、权限、外部系统边界变化，必须先由 Architecture agent 定义契约。
4. 小程序不得直接调用 `icepolar-dms`；DMS 只能由后端设备模块调用。
5. 多租户默认开启；新增业务表和查询必须考虑 `tenant_id` 与数据权限。
6. 不提交密钥，不修改本地私密配置。
7. 除非用户明确要求，不自动 commit、push、创建 PR 或合并 PR。
8. 阻塞时产出 `REPORT.md`，说明事实、影响、选项，暂停等待用户确认。

## 初始化
识别信息：

| 字段 | 要求 |
|------|------|
| Feature name | 短横线命名，如 `order-refund-reject` |
| 业务目标 | 用户要解决的问题 |
| 影响端 | `backend` / `admin` / `miniapp` / `icepolar-dms` / `governance` |
| UI/UX | 页面、组件、样式、交互变化时激活 |
| 契约 | API / DB / MQ / 依赖 / 权限 / 外部系统变化时激活 |

所有产物写入 `governance/feature-docs/{feature-name}/`：

| 文件 | 阶段 |
|------|------|
| `requirements-spec.md` | Phase 1 |
| `technical-design.md` | Phase 2 |
| `contract-changes.md` | Phase 2，契约变化时 |
| `ui-ux-design.md` | Phase 2，UI/UX 激活时 |
| `test-plan.md` 或 `test-notes.md` | Phase 3 |
| `review-report.md` | Phase 4 |
| `CHANGE-REPORT.md` | Phase 4 |
| `REPORT.md` | 阻塞时 |

## 团队
| Agent | 文件 | 触发条件 |
|-------|------|----------|
| Requirements | `requirements-agent.md` | 始终 |
| Architecture | `architecture-agent.md` | 始终 |
| UI/UX | `ui-ux-agent.md` | 页面、组件、样式、交互变化 |
| Backend | `backend-agent.md` | `backend/` 变化 |
| Frontend | `frontend-agent.md` | `admin/` 变化 |
| MiniApp | `miniapp-agent.md` | `miniapp/` 变化 |
| Test | `test-agent.md` | 跨端流程、关键链路、回归风险 |
| Review | `review-agent.md` | 始终 |

UI/UX 设计必须先于 `admin/` 或 `miniapp/` 的界面实现完成。

## Phase 1: 需求分析
Requirements agent 产出 `requirements-spec.md`。

进入规格编写前，必须至少完成一轮与用户的问答确认，并把确认结论写入 `requirements-spec.md`。

必须包含：

- Scope：In Scope / Out of Scope / Deferred
- Use Cases：角色、目标、主流程、业务规则
- Frontend Requirements：用户可见页面与功能
- Edge Cases：业务边界与异常行为
- Acceptance Criteria：业务验收 checklist

门禁：

- 只描述 what，不写技术实现
- 范围边界清楚，无明显冲突
- 验收标准可测试或可人工验收
- 已完成至少一轮用户问答确认；未确认项已记录假设

阻塞：核心规则缺失；解释会导致不同实现；涉及财务/支付/权限/历史数据但缺少确认；目标端或目标用户不清楚。

## Phase 2: 技术设计
Architecture agent 产出 `technical-design.md`，定义模块边界、实现策略、契约状态和分支计划。

并行产物：

- 契约变化：`contract-changes.md`
- 新模式或偏离 ADR：新增 ADR
- UI/UX 激活：`ui-ux-design.md`

契约层必须声明状态：

| 层 | 状态 |
|----|------|
| API | 变更 / 复用 / N/A |
| DB schema | 变更 / 复用 / N/A |
| 事件/MQ | 变更 / 复用 / N/A |
| 权限与数据范围 | 变更 / 复用 / N/A |
| 依赖 | 变更 / 复用 / N/A |
| 外部系统 | 变更 / 复用 / N/A |
| ADR | 需要 / 不需要 |

契约写入：平台级写 `governance/ARCHITECTURE.md`；功能级写 `governance/feature-docs/{feature-name}/contract-changes.md`；机器可读写 `governance/CONTRACT/`。

分支计划：

| 仓库 | base | branch |
|------|------|--------|
| workspace root | `main` | `feat/{feature-name}` 或 N/A |
| `backend/` | `master` | `feat/{feature-name}` 或 N/A |
| `admin/` | `master` | `feat/{feature-name}` 或 N/A |
| `miniapp/` | `main` | `feat/{feature-name}` 或 N/A |
| `icepolar-dms/` | `main` | `feat/{feature-name}` 或 N/A |

门禁：

- `technical-design.md` 已完成
- 所有契约层有结论
- 契约变化已写入 `contract-changes.md`
- UI/UX 激活时已完成 `ui-ux-design.md`
- DB 变化包含迁移脚本名与回滚策略
- 用户已确认，或已记录可继续推进的假设

阻塞：契约冲突；破坏性 DB 变更无回滚；外部系统接入缺少版本/权限/SLA/回调策略；UI/UX 与需求冲突。

## Phase 3: 实现与测试
开发 Agent 按仓库所有权在 worktree 中实现；Test agent 按风险设计并执行测试。

顺序：后端契约和 DB 迁移优先；API client、前端页面、小程序页面基于冻结契约实现；UI/UX 激活时不得绕过 `ui-ux-design.md`；Test agent 可并行准备测试。

worktree 规则：

- 每个受影响子仓库创建独立 worktree，原子模块目录保持在 base 分支。
- worktree 目录放在 `.worktrees/{repo}-{feature-name}`。
- 所有命令仍从工作区根执行，进入 worktree 使用 `(cd .worktrees/... && cmd)`。
- 未经用户确认，不在 worktree 中 commit、push 或创建 PR。

创建示例：`(cd backend && git worktree add ../.worktrees/backend-{feature-name} -b feat/{feature-name} origin/master)`；其他仓库按 base 分支替换。

职责：`backend/` 负责 API/服务/迁移；`admin/` 负责后台页面/API client/E2E；`miniapp/` 负责小程序页面/配置/工具；`icepolar-dms/` 仅设备系统自身变化时修改；`governance/` 负责文档和契约。

验证命令按受影响仓库执行；无法执行必须记录原因：

```bash
(cd .worktrees/backend-{feature-name} && mvn test)
(cd .worktrees/admin-{feature-name} && pnpm ts:check && pnpm build)
(cd .worktrees/icepolar-dms-{feature-name} && pytest -v)
```

门禁：

- 实现与需求、设计、契约一致
- 必要验证已执行或记录原因
- 测试产物已写入 `test-plan.md` 或 `test-notes.md`
- 无非预期文件、密钥或本地私密配置变更

设计偏差：小偏差在 Phase 3 更新文档；结构性偏差回 Phase 2，并产出 `REPORT.md` 等待确认。

## Phase 4: 审查与交付
Review agent 产出 `review-report.md`，通过后产出 `CHANGE-REPORT.md`。

审查清单：

- 实现满足 `requirements-spec.md`
- 技术方案符合 `technical-design.md`
- 契约与 `contract-changes.md` 一致
- 无密钥、无私密配置
- 新查询满足租户隔离和数据权限
- DB 迁移存在且可回滚
- 测试覆盖变更范围，失败项已说明
- UI/UX 激活时视觉和交互一致
- 分支名、提交说明、PR 范围符合规范

`CHANGE-REPORT.md` 包含：业务目标、影响仓库和主要文件、契约变化、DB 迁移、测试结果、风险、建议 PR 标题和描述。

审查通过后暂停，等待用户确认是否 commit、push、创建 PR、使用 Gitee PR 流程、PR 合入后删除本地/远程 feature 分支。

PR 描述必须嵌入需求、设计、契约和 ADR 摘要，不只写文件路径。

## 阻塞报告模板
```markdown
# 阻塞报告 — [Feature]
## 当前阶段
## 已完成
## 阻塞点
## 影响
## 建议选项
## 需要用户确认的问题
```

## 完成标准
- 所有阶段门禁通过
- 用户已确认提交、推送、PR 或合并动作
- 验证命令已执行，或原因已记录
- `review-report.md` 和 `CHANGE-REPORT.md` 已归档
- PR 已创建，或用户明确选择暂不创建
- 工作区和子模块状态已报告清楚
- 交付文档归档在 `governance/feature-docs/{feature-name}/`
