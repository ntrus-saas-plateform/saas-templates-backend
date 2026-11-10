# P7.5 — Endpoint Registry

Endpoints live in `edge_p7_product_control_endpoints`, FK-linked to P7.2 product registry / platforms / environments. **No second product registry.**

Lifecycle: `PENDING_VALIDATION → VALIDATING → ACTIVE ⇄ DEGRADED ⇄ UNAVAILABLE → QUARANTINED | REVOKED`.

`QUARANTINED` / `REVOKED` forbid control dispatch (`assertEndpointAllowsDispatch`). Dispatch paths lock the row with `SELECT … FOR UPDATE` so quarantine races cannot slip through.

Sensitive mutations (register, validate, quarantine, exchange finalize, callbacks) write history + audit + outbox in the same TX via `runWithOutbox(EDGE_P7_OUTBOX_TENANT, …)`.

`credential_ref` is opaque only — plaintext secrets never stored.
