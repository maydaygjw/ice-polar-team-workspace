# Phase 1 Gate Report — Order Refund Reject

## Status

Resolved. User decisions received on 2026-07-05.

## Final Decisions

| # | Question | Decision |
|---|---|---|
| 1 | Re-apply control | Add `refund_reapply` tinyint(1) column. Admin chooses per rejection whether user can re-apply. Allow re-apply only when `refundStatus == 3 && refundReapply == 1`. |
| 2 | Max reject reason length | 255 characters. |
| 3 | OrderLogEnum value | `reject_refund`. |
| 4 | Clear `refundReason` on re-apply | Yes. Admin reject reason is retained only in `yshop_store_order_status` log. |

## Updated Artifacts

- `governance/feature-docs/order-refund-reject/requirements-spec.md`
- `governance/feature-docs/order-refund-reject/technical-design.md`
- `governance/feature-docs/order-refund-reject/contract-changes.md`
- `governance/feature-docs/order-refund-reject/ui-ux-design.md`

## Branch Plan for Phase 2

| Repo | Base branch | Feature branch |
|------|-------------|----------------|
| Workspace root | `main` | direct commits |
| `backend/` | `master` | `feat/order-refund-reject` |
| `admin/` | `master` | `feat/order-refund-reject` |
| `miniapp/` | `main` | `feat/order-refund-reject` |
| `icepolar-dms/` | `main` | not affected |

## Gate Checklist

- [x] Requirements spec with in-scope / out-of-scope boundaries
- [x] Technical design with DB changes, API contracts, module impact
- [x] Every contract layer has explicit status (changed / reused / N/A with reason)
- [x] API contracts documented: platform-level → `CONTRACTS.md`; feature-level → `contract-changes.md`
- [x] UI/UX design review approved
- [x] Branch names defined for every affected repo
- [ ] OpenAPI JSON snapshot generated if backend changed → deferred to Phase 2/3 via `extract-openapi` skill
