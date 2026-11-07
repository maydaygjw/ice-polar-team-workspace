# Project integration notes

Use these notes to orient in the repository. They describe current project conventions; verify the code and official documentation again when implementing a change.

## Code map

- AdaPay payment platform wiring, merchant SDK integration, and callbacks live under `backend/yshop-module-pay/`.
- Profit recipient/member and settlement-account sync is implemented in `yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitrecipient/ProfitRecipientServiceImpl.java`.
- Payment callback translation is in `yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/config/handlers/AdapayPayMessageHandler.java`.
- Reconciliation is in `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/reconciliation/AdapayReconciliationServiceImpl.java`.
- Merchant payment configuration and SDK versions are managed in the backend's payment module and Maven dependency management. Do not assume the SDK method signature solely from the raw API docs.

## Member and settlement account API facts

Check the corresponding sections in the [official trade API docs](https://docs.adapay.tech/api/trade.html#member) before relying on these facts:

- `Member.query` and `CorpMember.query` both require `app_id` and `member_id`.
- Profit-recipient sync requires an explicit `memberType` (`1` personal, `2` corporate) because the APIs are distinct; it calls `Member.query` for personal and `CorpMember.query` for corporate. Do not infer type from `member_id`, settlement-account type, or `object`, and do not silently fall back to the other endpoint.
- The documented corporate-member query response may omit `object`. Validate successful status and matching `member_id`, then map corporate fields such as `name`, `social_credit_code`, and `legal_person` according to the selected type.
- `SettleAccount.query` requires `app_id`, `member_id`, and `settle_account_id`. Its bank details are nested under `account_info`; read `bank_acct_type` from there. The API values are `1` for corporate and `2` for personal account type. Do not infer bank-account type from whether the member is a company or an individual.
- Corporate-member creation can return `pending` while manual review is outstanding. When bank details are supplied, AdaPay may create the settlement account after approval; without them, create a settlement account separately if the business flow requires one. Treat review and settlement-account state according to the documented status/callback flow, not as immediate approval.

## Operational and logging notes

- AdaPay account creation/deletion, payment/refund, and production configuration changes have external financial effects. Do not execute them as a diagnostic shortcut; use authorized test credentials/environment when integration verification is requested.
- For external calls, record enough DEBUG diagnostics to identify API, result status/error code, and masked member/account identifiers. Keep sensitive personal, corporate, bank, certificate, and credential fields out of logs. Avoid generic recursive payload logging: provider fields evolve and redaction lists can miss new sensitive fields.
- Distinguish code-level validation from live verification. A successful local build or unit test does not prove AdaPay accepted the request or that remote merchant data was synchronized.
