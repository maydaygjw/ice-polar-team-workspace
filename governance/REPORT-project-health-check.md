# REPORT: Project Health Check — Documentation Drift & Structural Issues

## Context

按 `governance/PROMPTS/create-team.md` 启动工程团队流程，先读取了 `CLAUDE.md`、`ARCHITECTURE.md`、`CONTRACTS.md`、全部 `AGENTS/` 和 `PLAYBOOKS/` 定义，并检查了四个子模块的实际代码状态。

## Problem / Question

治理文档与实际代码存在多处严重不一致，且多个被引用的目录完全缺失。这些问题如果不修复，会导致 AI agent 基于错误假设做设计和开发决策。

## Findings

### 🔴 P0 — 技术栈描述错误 ✅ FIXED

| 位置 | 文档声称 | 实际 |
|------|---------|------|
| `ARCHITECTURE.md:17` | `icepolar-dms` 是 **Go** | 实际是 **Python 3.12 + FastAPI + SQLAlchemy 2.x** |

**修复：** `ARCHITECTURE.md` 仓库布局图中 `icepolar-dms` 的技术栈已从 "Go" 改为 "Python/FastAPI"。

### 🔴 P0 — 仓库名称不一致 ✅ FIXED

文档中大量使用旧仓库名，与实际子模块目录名不符：

| 文档位置 | 文档中的名称 | 实际目录名 | 状态 |
|----------|-------------|-----------|------|
| `ARCHITECTURE.md:6-18` | `yshop-drink/`, `yshop-drink-vue/` | `backend/`, `admin/` | ✅ 已修复 |
| `PLAYBOOKS/feature-development.md:8-9` | `yshop-drink/`, `yshop-drink-vue/` | `backend/`, `admin/` | ✅ 已修复 |
| `AGENTS/backend-agent.md` | `yshop-drink/`, `yshop-drink-vue/`, `yshop-module-*/` | `backend/`, `admin/`, `backend/yshop-module-*/` | ✅ 已修复 |
| `AGENTS/frontend-agent.md` | `yshop-drink-vue/`, `yshop-drink/` | `admin/`, `backend/` | ✅ 已修复 |
| `AGENTS/miniapp-agent.md` | `yshop-drink-vue/src/pages/`, `src/uni_modules/` | — | ✅ 已重写，正确对应 `miniapp/` |

**修复：** 所有文档中的旧仓库名已统一替换为实际子模块目录名。

### 🔴 P0 — 关键治理目录缺失 ✅ FIXED

| 被引用的目录 | 之前状态 | 当前状态 |
|-------------|---------|---------|
| `governance/ADR/` | 完全不存在 | ✅ 已创建，含 ADR 模板 |
| `governance/KNOWLEDGE/` | 完全不存在 | ✅ 已创建 |

### 🟡 P1 — 子模块处于 detached HEAD ✅ FIXED

所有四个子模块都已切回对应分支并建立远程跟踪：

| 子模块 | 之前状态 | 当前状态 |
|--------|---------|---------|
| `backend/` | detached at `a1d10b1` | ✅ `master` tracking `origin/master` |
| `admin/` | detached at `8bc955f` | ✅ `master` tracking `origin/master` |
| `miniapp/` | detached at `afcff75` | ✅ `main` tracking `origin/main` |
| `icepolar-dms/` | detached at `4f35b20` | ✅ `main` tracking `origin/main` |

### 🟡 P1 — CONTRACTS.md 内容严重不完整

当前只定义了：
- Admin API Prefix
- Core Entity ID Types
- Commission Contract
- Store Revenue Type Enum
- Common Result Structure

**缺失的关键合约：**
- Device / DMS 接口合约（backend ↔ icepolar-dms）
- Order Status 状态机合约（与 ARCHITECTURE.md 中的三字段状态机对应）
- Payment Callback 合约
- Mini-program `app-api/` 端点列表
- Tenant 隔离相关的 header / context 传递合约

### 🟡 P1 — local-development.md 缺少 icepolar-dms

只覆盖了 backend、admin、miniapp，没有 DMS 的本地启动说明。DMS 是独立的 FastAPI 服务，有自己的依赖安装和启动命令。

## Options

| 选项 | Pros | Cons |
|------|------|------|
| **A. 先修复治理文档，再启动团队** | 一劳永逸，避免 agent 持续踩坑 | 需要一定时间，延迟 feature 开发 |
| **B. 先启动团队，边开发边修文档** | 不阻塞开发进度 | agent 会持续遇到路径错误、技术栈错误，效率极低 |
| **C. 仅修复阻塞开发的最小集合** | 快速恢复开发能力 | 文档债务继续累积，长期更混乱 |

## Recommendation

**选 A — 先集中修复治理文档。** 理由是：

1. 当前不一致已经达到 "agent 无法可靠工作" 的程度，不是小修小补能解决的
2. ADR/ 和 KNOWLEDGE/ 的缺失意味着架构决策没有历史依据
3. detached HEAD 意味着即使文档修好了，开发工作流第一步就走不通

## 修复清单（建议优先级）

### 第一步：修复子模块开发工作流 ✅ DONE
```bash
# 对每个子模块，切换到对应分支并建立跟踪
(cd backend && git checkout master && git branch -u origin/master)
(cd admin && git checkout master && git branch -u origin/master)
(cd miniapp && git checkout main && git branch -u origin/main)
# icepolar-dms 不 push，但仍需跟踪 main 以便拉取
(cd icepolar-dms && git checkout main && git branch -u origin/main)
```

### 第二步：统一文档中的仓库名称 ✅ DONE
- 将 `ARCHITECTURE.md`、`PLAYBOOKS/*.md`、`AGENTS/*.md` 中的 `yshop-drink/` 统一为 `backend/`
- 将 `yshop-drink-vue/` 统一为 `admin/`
- 将 `yshop-drink`（backend 仓库名）统一为 `backend/`

### 第三步：修正技术栈描述 ✅ DONE
- `ARCHITECTURE.md:17`：icepolar-dms 从 "Go" 改为 "Python/FastAPI"

### 第四步：澄清 uniapp 代码位置 ✅ DONE
- `miniapp/` 是原生微信小程序，不是 uniapp；已重写 `miniapp-agent.md`
- `admin/` 只有 Vue3 admin dashboard，没有 uniapp C-end 代码
- 已更新 `backend-agent.md` 的 "Frontend Consumers" 描述

### 第五步：补齐缺失目录 ✅ DONE
```bash
mkdir -p governance/ADR governance/KNOWLEDGE
# 添加 ADR 模板
```

### 第六步：补齐 CONTRACTS.md ⏳ TODO
- 添加 Device ↔ DMS 接口合约
- 添加 Order Status 状态机合约（将 ARCHITECTURE.md 中的表格正式化）
- 添加 app-api/ 核心端点列表

### 第七步：更新 local-development.md ⏳ TODO
- 添加 icepolar-dms 本地开发说明（Python venv, requirements, uvicorn）

## 修复总结

所有 **P0 问题已修复**，剩余 **P1 问题（CONTRACTS.md 补全、local-development.md 更新）** 待后续处理。

| 优先级 | 问题 | 状态 |
|--------|------|------|
| P0 | 技术栈描述错误 | ✅ 已修复 |
| P0 | 仓库名称不一致 | ✅ 已修复 |
| P0 | 关键治理目录缺失 | ✅ 已修复 |
| P1 | 子模块 detached HEAD | ✅ 已修复 |
| P1 | CONTRACTS.md 内容不完整 | ⏳ 待处理 |
| P1 | local-development.md 缺少 icepolar-dms | ⏳ 待处理 |
