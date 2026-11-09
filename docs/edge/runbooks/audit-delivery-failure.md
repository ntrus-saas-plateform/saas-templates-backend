# Runbook — Audit delivery failure

## Symptoms
- Sensitive Edge mutation succeeded but audit row missing.
- Metrics `edge_audit_persistence_failures` increasing.

## Actions
1. Check Control Plane `audit_logs` / Edge audit writer connectivity.
2. Prefer fail-closed for highest-risk mutations if audit write is mandatory for that action.
3. Backfill from application logs only with correlation IDs — never invent audit rows.
