# ice-polar-team-workspace

AI team workspace for the yshop / ice-polar ecosystem.

Uses **Git Submodules** so AI tools (Superset, Cursor, Claude Code) can index all repositories while keeping each project independently versioned.

## Quick Start

```bash
git clone --recurse-submodules https://github.com/maydaygjw/ice-polar-team-workspace.git
cd ice-polar-team-workspace
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## What's Inside

### governance/

AI team knowledge center — the single source of truth.

| File/Dir | Purpose |
|----------|---------|
| `governance/CLAUDE.md` | Team constitution — read first |
| `governance/ARCHITECTURE.md` | System architecture and data flow |
| `governance/CONTRACTS.md` | Cross-repo API/Event/DTO contracts |
| `governance/AGENTS/` | Agent role definitions |
| `governance/PLAYBOOKS/` | Standard operating procedures |
| `governance/PROMPTS/` | Reusable prompt templates |
| `governance/ADR/` | Architecture Decision Records |
| `governance/KNOWLEDGE/` | Domain knowledge base |

### Submodules

| Directory | Repository | Tech Stack | Branch |
|-----------|-----------|------------|--------|
| `backend/` | [yshop-drink](https://gitee.com/icepolar/yshop-drink) | Java 17, Spring Boot | `master` |
| `admin/` | [yshop-drink-vue](https://gitee.com/icepolar/yshop-drink-vue) | Vue3, Vite, Element Plus | `master` |
| `miniapp/` | [icepolarminiapp](https://gitee.com/icepolar/icepolarminiapp) | Native WXML/WXSS/JS | `main` |

## Why Submodules?

| Approach | AI Indexing | Independent Versioning | Superset Workspace |
|----------|-------------|------------------------|-------------------|
| `gitignore` + manual clone | ❌ Ignored | ✅ Yes | ❌ No |
| Monorepo | ✅ Yes | ❌ No | ✅ Yes |
| **Git Submodule** | ✅ Yes | ✅ Yes | ✅ Yes |

Submodules let AI tools see, search, and reference code across all repos (`@backend/src/...`) while each repo remains an independent Git project with its own PRs and CI.

## Daily Workflow

```bash
# Pull workspace + all submodules
git pull --recurse-submodules

# Or update submodules only
git submodule update --remote

# Check status across all repos
for d in backend admin miniapp; do echo "[$d] $(cd $d && git status --short | wc -l | xargs) changes"; done
```

## Directory Layout

```
ice-polar-team-workspace/
├── governance/
│   ├── CLAUDE.md
│   ├── ARCHITECTURE.md
│   ├── CONTRACTS.md
│   ├── ADR/
│   ├── AGENTS/
│   ├── PLAYBOOKS/
│   ├── PROMPTS/
│   └── KNOWLEDGE/
├── backend/          ← submodule (yshop-drink)
├── admin/            ← submodule (yshop-drink-vue)
├── miniapp/          ← submodule (icepolarminiapp)
├── .gitmodules
└── README.md
```
