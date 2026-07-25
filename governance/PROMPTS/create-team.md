# 创建工程团队

正式功能交付编排器。按需加载 Agent，推进规格、设计、实现、验证、审查；单文件修复、咨询、纯 review 不使用本流程。

## 全局约束

- 所有命令从工作区根执行；子目录命令使用 `(cd subdir && cmd)`。
- 先读 `governance/CLAUDE.md`；仅按 `meta.yaml` 加载目标仓库 `AGENTS.md`、专业 Agent、架构和 ADR。
- API、DB、MQ、权限、依赖、外部系统变化必须先定义契约。
- 小程序不得直连 DMS；业务表和查询默认检查租户及数据权限。
- 不提交密钥或私密配置。未经用户明确授权，不 commit、push、创建或合并 PR。
- 仅高风险歧义、破坏性操作、远程环境操作和交付动作需要用户确认。

## Feature 文档目录与 Meta

功能目录名使用创建日期前缀：`governance/feature-docs/{YYYY-MM-DD}-{feature}/`，例如 `governance/feature-docs/2026-07-26-order-refund-reject/`。其中日期使用功能文档首次创建当天的本地日期，`feature` 使用短横线命名的功能标识。

在 `governance/feature-docs/{YYYY-MM-DD}-{feature}/meta.yaml` 维护路由和进度，不写业务、设计、对话或文件清单：

```yaml
feature: order-refund-reject
status: requirements # requirements|design|implementation|verification|review|done
risk: high            # low|medium|high
targets: [backend, admin]
contract: true
ui: true
e2e: true
blocked: false
```

更新时只修改状态字段。已有 feature 没有 meta 时先从现有文档推断并创建；不重复读取已完成阶段全文，除非后续工作依赖其内容。

### 按需加载

| 条件 | 加载 |
|---|---|
| `targets` | 对应开发 Agent、子仓库 `AGENTS.md`；DMS 使用 `dms-agent.md` |
| `contract: true` | Architecture、`ARCHITECTURE.md`、相关 ADR |
| `ui: true` | UI/UX Agent |
| `e2e: true` | Test Agent |
| `status: review` | Review Agent |

## 产物

目录：`governance/feature-docs/{YYYY-MM-DD}-{feature}/`

| 文件 | 条件 |
|---|---|
| `meta.yaml` | 始终 |
| `requirements-spec.md` | 始终 |
| `technical-design.md` | 有架构决策或契约变化 |
| `contract-changes.md` | `contract: true` |
| `ui-ux-design.md` | `ui: true` |
| `test-notes.md` | 始终 |
| `test-plan.md` | 复杂 E2E |
| `review-report.md` | 始终 |
| `CHANGE-REPORT.md` | 始终 |
| `REPORT.md` | 真正阻塞时 |

文档只记录本功能增量；无变化项写 `N/A: 原因`，不创建空章节，不复制其他文档内容。

## Phase 1: Requirements

Requirements Agent 产出：Scope、Use Cases、Business Rules、Frontend Requirements、Edge Cases、Acceptance Criteria、Assumptions。

门禁：范围明确；验收标准可验证；高风险歧义已确认。需求完整时直接记录规格和假设，不为满足流程强制提问。问题一次最多 3 个，标明是否阻塞及默认处理。

## Phase 2: Design

`contract=false` 且无架构决策时跳过 Architecture Agent 和 `technical-design.md`。否则 Architecture Agent 定义：模块影响、关键决策、契约增量、迁移/回滚和风险。

契约层：API、DB、MQ、权限/数据范围、依赖、外部系统、ADR。只展开变化项；功能级写 `contract-changes.md`，平台级同步 `ARCHITECTURE.md`，实现后的机器快照写 `CONTRACT/`。

UI 变化时先完成 `ui-ux-design.md`。仅不兼容契约、破坏性 DB、支付/财务/权限/历史数据、新外部系统或不可逆决策需要用户确认。

## Phase 3: Implementation & Verification

开发 Agent 按 `targets` 在 `.worktrees/{repo}-{feature}` 实现；原子模块目录保持基线分支。后端契约和迁移优先，消费端基于冻结契约实现。

基线：workspace/miniapp/DMS 为 `main`，backend/admin 为 `master`；分支统一 `feat/{feature}`。

```bash
(cd backend && git worktree add ../.worktrees/backend-{feature} -b feat/{feature} origin/master)
```

每个受影响仓库必须完成编译/构建和目标仓库要求的测试，结果写入 `test-notes.md`：

```bash
(cd .worktrees/backend-{feature} && mvn test)
(cd .worktrees/admin-{feature} && pnpm ts:check && pnpm build:prod)
(cd .worktrees/icepolar-dms-{feature} && python -m compileall -q app && pytest -v)
```

复杂 E2E 使用 `test-plan.md` 和 `governance/e2e/specs/features/{feature}/`。结构性设计偏差返回 Phase 2；仅无法安全假设时生成 `REPORT.md` 并暂停。

门禁：实现符合规格和契约；所有受影响仓库编译/构建通过；必要测试有结果；无非预期文件、密钥或私密配置。

## Phase 4: Review & Delivery

Review Agent 只报告问题、验证缺口和结论，产出 `review-report.md`。通过后生成 `CHANGE-REPORT.md`：业务结果、影响仓库、契约/迁移、验证结果、残余风险、建议 PR 标题和描述。

完成分两级：

- Implementation complete：规格、实现、验证、审查完成。
- Delivery complete：用户选择的 commit、push、PR 或部署动作完成；选择保留本地变更也是合法终态。

交付前一次性询问所需动作。PR 标题和正文由本编排器根据 `CHANGE-REPORT.md` 生成；创建 Gitee PR 时调用对应 PR skill。

### Teardown（合并后清理）

PR 合并后，按用户授权执行清理：

1. 删除远程 feature 分支：
   ```bash
   (cd .worktrees/backend-{feature} && git push origin --delete feat/{feature})
   (cd .worktrees/admin-{feature} && git push origin --delete feat/{feature})
   ```
2. 移除 worktree：
   ```bash
   git -C backend worktree remove .worktrees/backend-{feature}
   git -C admin worktree remove .worktrees/admin-{feature}
   rm -rf .worktrees/backend-{feature} .worktrees/admin-{feature}
   ```
3. 删除本地 feature 分支：
   ```bash
   git -C backend branch -D feat/{feature}
   git -C admin branch -D feat/{feature}
   ```

标题使用 Conventional Commit：`type(scope): summary`。正文格式：

```markdown
## Summary
- 业务行为变化

## Repositories
- `backend`: 主要变更

## Contracts
- API/DB/MQ/权限变化；无变化写 N/A

## Verification
- `command`: pass/fail
- 未执行项及原因

## Risks
- 残余风险或 N/A

## References
- Feature/Issue/ADR
```

只保留适用章节；有 DB 迁移时增加 `## Migration`。PR 正文嵌入关键规格和验证摘要，不只列文档路径。

## 用户状态更新

仅在阶段切换、阻塞或需授权时输出：

```text
阶段：design
已完成：需求规格
下一步：冻结 API 契约后实现
需确认：退款权限范围（阻塞）
```
