# P7.5 — Callbacks & Reconciliation

**Callbacks** (`edge_p7_product_control_callbacks`): inbox with unique `idempotency_key` + `callback_id`. `ReceiveProductControlCallbackUseCase` verifies optional HMAC signature, writes history/audit, and returns `duplicate: true` on replay without inserting a second row.

**Reconciliation** (`edge_p7_product_control_reconciliation`): opens/resolves records for `UNKNOWN_OUTCOME` / `RECONCILIATION_REQUIRED` exchanges. Outcome applied transactionally with exchange status + audit.
