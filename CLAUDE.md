# CLAUDE.md

This file is the **team constitution** for the yshop AI engineering team. It is the highest authority. All agents must read this first before any work.

## Core Principles

1. **Multi-repo, not monorepo** — Backend (`yshop-drink/`) and frontend (`yshop-drink-vue/`) are separate repositories with clear boundaries.
2. **API first** — Any cross-repo change starts with contract definition in `CONTRACTS.md`.
3. **Multi-tenant by default** — All business tables contain `tenant_id`. MyBatis Plus interceptor injects it automatically.
4. **Event-driven for async flows** — Payment callbacks, order timeouts, and notifications use MQ (RocketMQ) or Redis delay queue.
5. **Historical data is immutable** — Order snapshots freeze data at payment time. Never retroactively modify historical records.
6. **Commission > Inheritance** — When multiple rules apply (e.g., commission rates), the most specific rule wins (category > shop).

## Red Lines

- Never commit secrets (DB passwords, API keys, JWT secrets) to any repository.
- Never modify `sql/yixiang-drink.sql` directly for upgrades; always create `sql/upgrade-*.sql`.
- Never change order status semantics in enums without updating all references (DO, VO, Mapper XML, frontend constants).
- Never skip tenant isolation in new queries.

## System Boundary

```
[WeChat MiniApp / H5]     [Admin Dashboard]     [IcePolar MiniApp]
         ↓                       ↓                      ↓
    [yshop-drink-vue]      [yshop-drink-vue]     [icepolarminiapp]
         ↓                       ↓                      ↓
    [yshop-drink Backend] ←——→ [Redis / MQ] ←——→ [yshop-drink Backend]
         ↓                                              ↓
    [MySQL 8.0]                                    [MySQL 8.0]
```

> `icepolarminiapp` is a native WeChat Mini Program for the ice-machine business (tenant-id: 153). It shares the same `yshop-drink` backend but is a separate frontend codebase.

## Governance Directory

| File/Dir | Purpose |
|----------|---------|
| `CLAUDE.md` | This file — team constitution |
| `ARCHITECTURE.md` | System-wide architecture and data flow |
| `CONTRACTS.md` | Cross-repo API/Event/DTO contracts |
| `AGENTS/` | Agent role definitions |
| `ADR/` | Architecture Decision Records |
| `PLAYBOOKS/` | Standard operating procedures |
| `PROMPTS/` | Reusable team prompt templates |
| `KNOWLEDGE/` | Domain knowledge base |
