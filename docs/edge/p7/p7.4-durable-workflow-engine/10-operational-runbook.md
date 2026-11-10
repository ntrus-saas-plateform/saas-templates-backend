# P7.4 — Operational Runbook

## Enable worker loop

`WorkflowWorkerBootstrap` registers JobScheduler jobs (`every:Ns`):

1. Poll claim → execute handler **outside** TX → persist with fencing
2. Reconcile (optional Redis leader lock `platform:lock:edge-workflow-worker`)

Config knobs (optional on `EnvironmentConfig`):

- `WORKFLOW_WORKER_ENABLED` (default on unless explicitly false)
- `WORKFLOW_WORKER_INTERVAL_SECONDS` (default 5)
- `WORKFLOW_RECONCILE_INTERVAL_SECONDS` (default 30)
- `WORKFLOW_STEP_LEASE_MS` (default 30000)
- `WORKFLOW_WORKER_ID`

## Operator flow

1. Create / validate / publish definition
2. Create instance (idempotency key; auth+placement revalidated when refs present)
3. Start (COMMITTED placement if bound)
4. Workers claim/complete; human tasks for `noop:approve`
5. Pause / resume / cancel / retry / reconcile as needed

## Reconciliation actions

- Expired leases → requeue READY
- Due retries → READY
- Expired human tasks → EXPIRED
- Revoked auth → REQUIRES_INTERVENTION
- Deadline exceeded → TIMED_OUT

## Explicit non-goals

No live BB / infra / Keycloak provisioning. Unavailable handlers must stay unavailable until P7.5+.
