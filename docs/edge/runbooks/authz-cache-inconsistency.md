# Runbook — Authorization cache inconsistency

## Symptoms
- Permissions changed but Edge UI/API still allows or denies incorrectly within TTL.

## Actions
1. Invalidate `edge:authz:*` for affected administrator/membership.
2. Confirm sensitive operations re-resolve from PostgreSQL.
3. Review invalidation hooks after role assign/revoke, membership/vertical/admin suspension, delegation/emergency changes.
