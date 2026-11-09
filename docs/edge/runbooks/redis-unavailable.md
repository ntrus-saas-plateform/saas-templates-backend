# Runbook — Redis unavailable (Edge)

## Impact
- Token denylist / authz freshness cache may degrade.
- Distributed locks for scheduled jobs may fail.

## Policy
- Redis is **never** the source of truth for Edge authorization.
- Prefer fail-closed for denylist checks when configured; document env behavior.
- Workspace session validation must still hit PostgreSQL.

## Recovery
1. Restore Redis.
2. Invalidate Edge authz cache keys (`edge:authz:*`).
3. Spot-check workspace switch and privileged operations.
