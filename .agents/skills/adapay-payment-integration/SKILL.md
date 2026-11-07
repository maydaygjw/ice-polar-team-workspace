---
name: adapay-payment-integration
description: "Work on AdaPay integration in this workspace: payment flows, members and settlement accounts, profit sharing, callbacks, reconciliation, or troubleshooting. Use when changing or diagnosing AdaPay behavior; use the WeChat Pay skill for WeChat-only work."
---

# AdaPay integration in this workspace

Use this skill for AdaPay work in the `backend/` submodule. Start with the repository guidance: read `governance/CLAUDE.md`, the relevant architecture or feature contract, `governance/AGENTS/backend-agent.md`, and `backend/AGENTS.md`. For cross-repository/API changes, update or establish the contract in `governance/CONTRACTS.md` before implementation.

Before changing an endpoint, parameter, response mapping, status, or error behavior, verify it against the current [AdaPay trade API documentation](https://docs.adapay.tech/api/trade.html) and the actual `holuntech pay-java-adapay` SDK version in this project. The SDK wrapper can differ from the raw API. Consult [project integration notes](references/project-integration.md) for code locations and member/settlement details.

Keep the existing tenant-aware payment configuration and SDK integration. Follow the established service and callback paths; do not introduce direct HTTP calls or a second payment abstraction without a concrete requirement. Preserve idempotency, payment-attempt identity, callback-driven state transitions, and immutable payment-time snapshots.

Treat member identity, business registration, bank account, certificate, and merchant credentials as sensitive. Follow backend logging rules: log external-call request/response diagnostics at DEBUG, using concise summaries with masked identifiers; never log complete sensitive payloads or credentials. Do not create/delete settlement accounts, initiate/refund payments, alter live merchant configuration, inspect/mutate remote databases, or deploy unless that specific external action is authorized in the active request.

For code changes, follow the backend agent's module boundaries, tenant isolation, and verification guidance. State what was checked and whether any live AdaPay or database verification was actually performed.
