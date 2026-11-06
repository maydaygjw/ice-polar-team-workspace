# 工作区指南

本文件是供 Agent 使用的导航页。按任务阅读相关文档；系统知识放在 `governance/`，项目级说明放在对应子模块中。

## 仓库导航

| 路径 | 项目 | 项目说明 |
|---|---|---|
| `backend/` | Java / Spring Boot 后端 | [`backend/AGENTS.md`](backend/AGENTS.md)、[`backend/CLAUDE.md`](backend/CLAUDE.md) |
| `admin/` | Vue 管理后台 | [`admin/AGENTS.md`](admin/AGENTS.md) |
| `miniapp/` | 微信原生小程序 | 查看子模块内的项目说明 |
| `h5/` | Vue 活动 H5 | 查看子模块内的项目说明 |
| `icepolar-dms/` | Python 设备管理服务 | [`icepolar-dms/AGENTS.md`](icepolar-dms/AGENTS.md) |
| `mock-external-server/` | 外部服务模拟器 | 查看子模块内的项目说明 |
| `governance/` | 团队共享工程知识 | 见下方文档入口 |

各产品目录都是独立版本管理的 Git 子模块。修改应落在所属仓库中，并谨慎更新工作区中的子模块指针。

## 文档入口

- [工作区操作规则](CLAUDE.md)：Shell 工作目录保持在工作区根目录；在子模块执行命令时使用子 Shell。
- [团队章程](governance/CLAUDE.md)：系统边界和工程原则。
- [系统架构](governance/ARCHITECTURE.md)：系统结构和数据流。
- [跨仓库契约](governance/CONTRACTS.md)：API、事件和共享 DTO。
- [Agent 角色说明](governance/AGENTS/)：各类任务的职责定义。
- [操作手册](governance/PLAYBOOKS/)：开发、测试、部署和事故处理流程。
- [知识库](governance/KNOWLEDGE/)与 [架构决策记录](governance/ADR/)：领域知识和已记录的决策。
- [功能文档](governance/feature-docs/)：已开展工作的需求、设计和交付记录。
- [需求待办](governance/BACKLOG/)：尚未细化的业务需求，新增条目请使用[模板](governance/BACKLOG/TEMPLATE.md)。

## 执行不变量

- **跨仓库变更先定义契约。** 修改提供方或调用方之前，先在 [`governance/CONTRACTS.md`](governance/CONTRACTS.md) 定义或更新契约。
- **保持租户隔离。** 新增后端业务数据和查询必须符合[团队章程](governance/CLAUDE.md)及[系统架构](governance/ARCHITECTURE.md)中的租户规则。
- **保持历史记录稳定。** 不得改写已冻结的业务快照；变更状态语义时，须同步更新所有受影响的仓库和契约。
- **遵守系统边界。** 小程序不得直接调用 `icepolar-dms`；设备操作经由后端处理。
- **不得提交密钥。** 凭据和本地环境变量不得进入版本控制，使用项目规定的示例配置方式。
- **不得自动提交。** 除非用户明确要求提交，否则保留改动供用户审阅。
- **谨慎更新子模块指针。** 完成前检查工作区和受影响子模块的 Git 状态。

## 构建与验证

遵循目标子模块自己的命令和约定。修改前先阅读其中的 `AGENTS.md`（如果存在）；本工作区由多个独立仓库组成，不要假设存在统一的测试命令。

常用命令入口（从工作区根目录运行）：

```bash
git submodule update --init --recursive
git pull --recurse-submodules
(cd backend && mvn clean test)
(cd admin && pnpm ts:check)
(cd icepolar-dms && pytest -v)
```

其他验证方式请参照对应子模块说明和[本地开发手册](governance/PLAYBOOKS/local-development.md)。完成任务时说明运行过的命令，以及未能运行的命令。

## 变更与交付约定

- 实现细节遵循目标子模块的 `AGENTS.md` 和既有代码习惯。
- 工作区提交标题使用 Conventional Commit 类型和范围，描述用中文，例如：`feat(device): 增加设备状态查询`。
- 仅修改治理文档时可直接提交到主分支；其他变更的交付和 PR 要求遵循所属仓库的说明。
- 新增待办条目只记录业务问题。技术设计和契约在功能工作流中完成，不写入原始待办。
