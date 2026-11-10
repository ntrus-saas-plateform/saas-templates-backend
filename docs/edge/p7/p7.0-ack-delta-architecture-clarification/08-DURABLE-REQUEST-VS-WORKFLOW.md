# 08 — Durable Request vs Durable Workflow (DELTA-07)

| Document ID | P7.0-ACK-DELTA-08 | Decision | **D-SEP-01** |

## Separation

| Capability | Workstream | Does | Does not |
|------------|------------|------|----------|
| Durable Provisioning Request | **P7.1** | Receive/verify auth, persist request, history, cancel, operator visibility | Create infra, KC, BB tenant, run saga, activate |
| Durable Workflow Engine | **P7.4** | Multi-step exec, leases, fencing, compensate, human tasks | Own commercial authorization |

## Guarantees

**P7.1:** durable persistence, atomic record, idempotency, audit, restart recovery, **zero technical side effects**.  

**P7.4:** durable execution, crash recovery, fencing, safe retry, compensation, non-compensable op policy, human intervention.

## Contract between them (future)

`Accepted ProvisioningRequest` → (later) `StartWorkflowCommand(request_id, auth_ref)`  
Accepted ≠ workflow started ≠ provisioned ≠ ACTIVE.

## UI rule

P7.1 screens must not show technical **ACTIVE** tenant from request acceptance alone.
