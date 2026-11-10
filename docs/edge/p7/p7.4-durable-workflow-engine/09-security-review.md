# P7.4 — Security Review

## RBAC

Operator APIs under `edge/workflows*` and `edge/workflow-tasks*` use granular `platform:workflow*` permissions.

Worker APIs under `edge/workflow-workers*` require `platform:workflow:worker` (M2M), separate from human operator grants.

## Fail-closed authorization / placement

- Create/start/resume/retry revalidate P7.1 via `WorkflowAuthorizationPort`.
- Start requires placement PLACED + **COMMITTED** reservation when a placement decision is bound.
- Revoked/expired/uncertain auth → hold / forbid (never silent continue).

## Worker trust

- Lease owner + fencing token validated on renew/complete/fail.
- Stale fencing rejected (`CONFLICT`).
- Handlers are registered in-process only; DB cannot inject executable code.
- P7.5/6/7 keys always return `DEPENDENCY_UNAVAILABLE` (no simulated success).

## Audit / outbox

Sensitive mutations use `ControlPlaneOutboxTransactionService.runWithOutbox` with mandatory `audit.create(client)`. Audit/outbox failure rolls back state.
