# FHL Workspace

AI team workspace for the yshop / ice-polar ecosystem.

## What's Inside

This repository serves as the **workspace entrypoint** and **AI team knowledge center**.

### Governance

| File/Dir | Purpose |
|----------|---------|
| `CLAUDE.md` | Team constitution — read first |
| `ARCHITECTURE.md` | System architecture and data flow |
| `CONTRACTS.md` | Cross-repo API/Event/DTO contracts |
| `AGENTS/` | Agent role definitions |
| `PLAYBOOKS/` | Standard operating procedures |
| `PROMPTS/` | Reusable prompt templates |
| `ADR/` | Architecture Decision Records |
| `KNOWLEDGE/` | Domain knowledge base |

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/clone-all.sh` | Clone all sub-project repositories |
| `scripts/pull-all.sh` | Pull latest changes for all repos |
| `scripts/status-all.sh` | Show git status across all repos |

### Sub-Projects

Sub-projects are cloned into `repos/` as independent Git repositories:

| Directory | Repository | Tech Stack |
|-----------|-----------|------------|
| `repos/backend/` | [yshop-drink](https://gitee.com/icepolar/yshop-drink) | Java 17, Spring Boot |
| `repos/admin/` | [yshop-drink-vue](https://gitee.com/icepolar/yshop-drink-vue) | Vue3, Vite, Element Plus |
| `repos/miniapp/` | [icepolarminiapp](https://gitee.com/icepolar/icepolarminiapp) | Native WXML/WXSS/JS |

## Quick Start

```bash
# Clone this workspace
git clone https://github.com/maydaygjw/ice-polar-team-workspace.git
cd ice-polar-team-workspace

# Clone all sub-projects
./scripts/clone-all.sh

# Verify layout
./scripts/status-all.sh
```

## Directory Layout

```
ice-polar-team-workspace/
├── CLAUDE.md              ← Team constitution
├── README.md              ← This file
├── ARCHITECTURE.md
├── CONTRACTS.md
├── ADR/
├── AGENTS/
├── PLAYBOOKS/
├── PROMPTS/
├── KNOWLEDGE/
├── scripts/               ← Workspace scripts
│   ├── clone-all.sh
│   ├── pull-all.sh
│   └── status-all.sh
└── repos/                 ← Sub-project clones (gitignored)
    ├── backend/
    ├── admin/
    └── miniapp/
```
