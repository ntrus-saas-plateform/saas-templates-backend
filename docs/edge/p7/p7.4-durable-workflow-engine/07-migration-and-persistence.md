# P7.4 — Migration & Persistence

## Migration

`migrations/control-plane/099_edge_p7_durable_workflow_engine.sql`

Tables: definitions, definition_versions, instances, steps, attempts, checkpoints, compensations, human_tasks, history, dead_letters, worker_registry.

Permissions: `platform:workflow*`, `platform:workflow_definition*`, `platform:workflow_task*`, `platform:workflow:worker`.

SUPER_ADMIN: all. OPERATOR: read/manage/pause/resume/cancel/retry/reconcile + task ops + definition read (no publish/worker).

Ends with `schema_migrations` insert `099_edge_p7_durable_workflow_engine`. Does not alter 095–098.

## Persistence adapters

| Port | Implementation |
|------|----------------|
| `WORKFLOW_REPOSITORY_PORT` | `PgWorkflowRepository` — claim via `FOR UPDATE SKIP LOCKED`, fencing increment on claim, all writes accept `client?: unknown` |
| `WORKFLOW_AUTHORIZATION_PORT` | `PgWorkflowAuthorizationAdapter` — fail-closed over `ProvisioningRepositoryPort` |
| `WORKFLOW_PLACEMENT_PORT` | `PgWorkflowPlacementAdapter` — PLACED + HELD/COMMITTED via `PlacementRepositoryPort` |
| Handler registry | `WorkflowHandlerRegistry` — `noop:approve`, `noop:checkpoint`, `unavailable:p75/p76/p77` |

Wiring: `edge-persistence.module.ts` + `edge-application.providers.ts`.
