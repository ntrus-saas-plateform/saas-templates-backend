# 08 — Billing e2e evidence pack (template)

**Statut :** TEMPLATE — remplir en lab (`LIVE_COMPLETE_E2E=1` + compose)

| # | Scénario | Preuve attendue | Résultat | Correlation / SHA |
|---|----------|-----------------|----------|-------------------|
| 1 | Configure cadence MONTHLY + setup fee | `POST /billing/cadence` 200 ; schedule + snapshot.setupFee | | |
| 2 | Draft invoice first bill | Lines RECURRING + SETUP_FEE | | |
| 3 | Second draft | SETUP_FEE absent | | |
| 4 | Sandbox pay SUCCEEDED | Invoice PAID ; cash-truth collected ↑ | | |
| 5 | Payment FAILED | No PAID ; activate blocked | | |
| 6 | Open collection → notify | Attempt recorded ; queue email SKIPPED/QUEUED | | |
| 7 | Escalate → suspend | Sub SUSPENDED ; BB suspend if configured | | |
| 8 | Resolve → reactivate | Sub ACTIVE ; BB resume | | |
| 9 | Refund / credit note | Refund REQUESTED ; credit issued | | |
| 10 | Arch test HyperSwitch | `payment-orchestration-boundaries.spec` PASS | | |

**Env lab :** `BILLING_PAYMENT_ADAPTER=sandbox` (ou `hyperswitch` + webhook URL).
