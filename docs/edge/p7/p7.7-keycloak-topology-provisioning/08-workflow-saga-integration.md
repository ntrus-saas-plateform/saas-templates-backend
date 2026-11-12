# P7.7 — Workflow / Saga Integration (P7.4)

All P7.7 mutations run through the durable P7.4 workflow engine. No HTTP endpoint mutates Keycloak directly (**workflow-only invariant**).

## Handler keys (`KEYCLOAK_HANDLER_KEYS`)

| Handler key | Role |
|-------------|------|
| `keycloak.validate_plan` | Re-validate P7.x gates on persisted desired state |
| `keycloak.discover_capabilities` | Real `serverinfo` + organizations probe, persisted |
| `keycloak.provision_realm` | Realm create/adopt (Models A/B); `SKIPPED` for Model C |
| `keycloak.provision_organization` | Model B organizations (capability-gated) |
| `keycloak.configure_oidc` | Discovery fetch + validation + OIDC record |
| `keycloak.create_technical_client` | Contract-declared clients, secret → vault |
| `keycloak.verify_topology` | Realm exists + JWKS validated ⇒ `READY` |
| `keycloak.reconcile_topology` | Drift detection run |
| `keycloak.deprovision_topology` | Destructive, approval-gated (restricted key) |

`KEYCLOAK_RESTRICTED_HANDLER_KEYS = ['keycloak.deprovision_topology']`.

## Registration

`registerKeycloakHandlers(registry, KEYCLOAK_HANDLER_KEYS, liveExecutor)` is called by `WorkflowHandlerRegistry` (infrastructure) with the `KEYCLOAK_LIVE_EXECUTOR` from DI. Without a wired executor, every handler fails `DEPENDENCY_UNAVAILABLE` — **never simulated success**. `workflow.types.ts` adds the keys (plus `p7.7.keycloak.realm.create`, `p7.7.keycloak.org.create` labels) to the known-handler allow list.

## Step wiring (`KEYCLOAK_WORKFLOW_DEFINITIONS`)

**Provision** — code `p77.keycloak.topology.provision`:

```
validate_plan → capabilities → topology_provision → topology_organization
             → configure_oidc → create_client → verify_topology
```

| Step | Handler | Attempts | Timeout | Compensation |
|------|---------|----------|---------|--------------|
| `topology_provision` | `keycloak.provision_realm` | 3 | 300 s | `keycloak.deprovision_topology` |
| `topology_organization` | `keycloak.provision_organization` | 3 | 300 s | — |
| `configure_oidc` | `keycloak.configure_oidc` | 3 | 120 s | — |
| `create_client` | `keycloak.create_technical_client` | 3 | 120 s | — |
| `verify_topology` | `keycloak.verify_topology` | 3 | 120 s | — |

**Other definitions:** `p77.keycloak.topology.reconcile` (validate → reconcile), `p77.keycloak.topology.deprovision` (validate → deprovision, `maxAttempts: 1`), `p77.keycloak.topology.declare_client` (validate → create_client → verify_topology). Retry defaults: 3 attempts, 500 ms → 15 s backoff, ×2, jitter 0.2. Definitions are created/published idempotently by `ensureKeycloakDefinition` (DRAFT → VALIDATED → PUBLISHED inside one outbox TX).

## Compensation discipline

`KeycloakProvisioningHandler.compensate()`:

1. No live executor ⇒ fail (no fake compensation).
2. Invalid fencing token ⇒ fail — same discipline as execution.
3. Any key **other than** `keycloak.deprovision_topology` ⇒ returns `WAITING_APPROVAL` with `requiredPermission: 'platform:keycloak:deprovision'` (no ad-hoc rollback).

Deprovision itself (`keycloak.deprovision_topology` executor branch) requires `deprovisionAuthorized === true && deprovisionConfirmed === true` in the snapshot, otherwise it returns `WAITING_APPROVAL`. When authorized it records evidence and moves the topology to `DEPROVISIONING_PENDING`; actual realm deletion is deferred to retention policy (never a blind delete).

## Fencing discipline

- Engine-issued tokens are monotonically increasing positive integers.
- Handler guard: integer `>= 1` (defect #2 fixed — `0`/negative/`null` now rejected before any Keycloak call).
- Executor additionally runs a basic fencing assertion before dispatch.
- Optimistic locking: repository updates require the expected `version`; stale writes throw.

## Transaction / outbox pattern

Every mutation use case runs inside `ControlPlaneOutboxTransactionService.runWithOutbox(EDGE_P7_OUTBOX_TENANT, …)`:

| In the same TX | Mechanism |
|----------------|-----------|
| State row(s) | repository with explicit `client` |
| Immutable history | `appendHistory` |
| Durable audit | `requireAudit` — TX **fails** if audit cannot be written |
| Domain event | `enqueueEvt` (outbox) |
| Workflow instance / step transitions | P7.4 tables with the same `client` |

Workflow instances are created with an idempotency key (`getInstanceByIdempotencyKey` short-circuits duplicates) and bound back to the topology (`workflowId`, status `PENDING`, history `BIND_WORKFLOW`).
