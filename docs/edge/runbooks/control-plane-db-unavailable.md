# Runbook — Control Plane database unavailable

## Symptoms
- All `/api/v1/edge/**` endpoints fail.
- Migrations cannot run.
- Audit writes fail.

## Immediate actions
1. Check PostgreSQL `platform_control` connectivity and disk.
2. Distinguish liveness (process up) vs readiness (DB up) — Edge API should fail readiness when CP DB is down.
3. Do not fail over Edge authorization to Redis or frontend caches.

## Recovery
1. Restore DB; verify `schema_migrations` includes `073_edge_foundation`.
2. Confirm Edge tables readable; spot-check `edge_administrators`, `edge_workspace_sessions`.
3. Replay outbox if control-plane outbox backlog exists.
