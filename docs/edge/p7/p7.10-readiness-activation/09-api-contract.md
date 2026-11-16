# P7.10 — API Contract

Base (Nest): `EdgeActivationController` under `@EdgeRoute()`.  
Paths below are Edge routes as implemented on the controller.

> Distinct from P1 commercial readiness APIs (`/edge/readiness-evaluations`, console `/edge/readiness`).

## Evaluations

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/activation/evaluations` | read |
| GET | `/edge/activation/evaluations/:id` | read → `{ evaluation, checks, evidence }` |
| POST | `/edge/activation/evaluations` | evaluate |
| POST | `/edge/activation/evaluations/:id/evaluate` | evaluate → launches `p710.readiness.evaluate` |

Create body: `tenantId`, `productId`, `provisioningRequestId`, optional `subscriptionId` / `accountId` / `metadata`.  
Evaluate body: optional `idempotencyKey`, `correlationId`, `provisioningRequestId`, `activationRecordId`.

## Activation records

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/activation/records` | read |
| GET | `/edge/activation/records/:id` | read → `{ record, runs, evidence }` |
| POST | `/edge/activation/records` | activate (create only; does not activate) |
| POST | `/edge/activation/records/:id/evaluate` | evaluate (bound evaluation) |
| POST | `/edge/activation/records/:id/activate` | activate → launches `p710.activation.activate` |
| GET | `/edge/activation/records/:id/runs` | history:read |
| GET | `/edge/activation/records/:id/evidence` | history:read |

Create body: `tenantId`, `productId`, `provisioningRequestId`, optional `readinessEvaluationId` / `subscriptionId` / `accountId` / `metadata`.  
Activate / evaluate body: optional `idempotencyKey`, `correlationId`, `provisioningRequestId`.

## List query params

`limit` (1–200), `offset`, optional `status`, `tenantId`, `productId`, `provisioningRequestId`.

## Console

Canonical technical console: **`/edge/provisioning/readiness`**.  
Frontend client helpers: `edgeApi.listActivationEvaluations` / `createActivationRecord` / `activateActivationRecord` / … (`lib/api/edge.ts`), types in `types/edge-activation.ts`.
