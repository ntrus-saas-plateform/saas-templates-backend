# 17 — Events, outbox & idempotency

- Outbox tenant constant: `EDGE_P11_OUTBOX_TENANT` = `edge-p11-revenue-operations`
- Event types in `revenue.events.ts` (metric published, MRR computed, leakage transitioned, commission calculated, audit appended, retention/assurance when enabled)
- Commission `calculation_key` uniqueness enforces idempotent calculate
- Business audit append is durable and correlation-id aware
