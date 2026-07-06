# Phase 1 Gate Report: Adapay 分账结算

## 状态

**PASSED** — 用户已确认所有阻塞项，Phase 1 文档已统一，可进入 Phase 2。

## 用户决策记录

| 问题 | 用户决策 |
|------|----------|
| 1. 分账比例覆盖 | 仅使用店铺 `commission_rate`（选项 A） |
| 2. 平台级收款人唯一性 | 不强制唯一；增加分账角色（平台/配送方/销售方），同一租户同一角色只能有一个有效收款人 |
| 3. Adapay 字段 | 参考 Adapay 文档；本期先实现核心 `member_id`，结算账户绑定后续扩展 |
| 4. 分账失败兜底 | 支付时若缺少收款人则拒绝支付；分账失败后回退到 `RevenueJob` 虚拟余额结算 |
| 5. 退款与分账回退 | 本期不做分账回退 |
| 6. 权限标识 | 采用 `pay:profit-recipient:*`、`pay:profit-sharing:*` |

## 已更新文档

| 文档 | 路径 | 状态 |
|------|------|------|
| 需求规格 | `governance/feature-docs/adapay-profit-sharing/requirements-spec.md` | ✅ 已更新 |
| 技术设计 | `governance/feature-docs/adapay-profit-sharing/technical-design.md` | ✅ 已更新 |
| 合约变更 | `governance/feature-docs/adapay-profit-sharing/contract-changes.md` | ✅ 已更新 |
| UI/UX 设计 | `governance/feature-docs/adapay-profit-sharing/ui-ux-design.md` | ✅ 已更新 |
| ADR | `governance/ADR/adr-002-adapay-profit-sharing.md` | ✅ 已更新 |

## Gate 检查项

- [x] Requirements spec with in-scope / out-scope boundaries
- [x] Technical design with DB changes, API contracts, module impact
- [x] Every contract layer has explicit status (changed / reused / N/A with reason)
- [x] API contracts documented: platform-level → `CONTRACTS.md`; feature-level → `governance/feature-docs/{feature}/contract-changes.md`
- [ ] OpenAPI JSON snapshot generated if backend changed — **Phase 2 完成后由 `extract-openapi` skill 自动生成**
- [x] UI/UX design review approved (if activated)
- [x] Branch names defined for every affected repo

## 分支定义

| Repo | Base Branch | Feature Branch |
|------|-------------|----------------|
| `backend/` | `master` | `feat/adapay-profit-sharing` |
| `admin/` | `master` | `feat/adapay-profit-sharing` |
| Workspace root | `main` | direct commit |

## 下一步

进入 Phase 2: Parallel Implementation。
