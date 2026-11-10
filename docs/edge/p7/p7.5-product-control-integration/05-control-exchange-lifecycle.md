# P7.5 — Control Exchange Lifecycle

Durable table: `edge_p7_product_control_exchanges` (+ attempts).

States: `CREATED → QUEUED → SENDING → SENT → ACKNOWLEDGED → SUCCEEDED` with failure / retry / `UNKNOWN_OUTCOME` / `RECONCILIATION_REQUIRED → RECONCILED` / `CANCELLED`.

Idempotency: unique `idempotency_key`. Repeat handshake/discover with the same key returns the existing exchange without a second outbound call.

Timeout after send must become `UNKNOWN_OUTCOME` (never assume non-receipt). Reconciliation is an explicit operator/API action (`POST …/exchanges/:id/reconcile`).
