# Runbook — Membership / Keycloak Organization sync failure

## Symptoms
- Membership ACTIVE in CP but missing from Keycloak Organization (or reverse).
- `edge_sync_records` show failures.

## Actions
1. Classify drift via reconciliation — never auto-grant to heal.
2. Safe repair: remove stale external membership when CP says REVOKED/SUSPENDED.
3. Manual intervention for CP ACTIVE without external identity — re-invite or link explicitly with audit.
4. Re-test workspace switch for affected administrator.
