# P7.10 — Readiness Evaluation

## Purpose

A **TenantReadinessEvaluation** collects prior-phase evidence into durable check rows and an aggregate READY / NOT_READY verdict. It is the evidence input to the Activation Record gate — not a commercial readiness score from P1.

## Create

`CreateReadinessEvaluationUseCase`:

1. Require `provisioningRequestId`.
2. Load P7.1 workflow-ready authorization; revalidate bound row/version (fail-closed).
3. Persist evaluation `PENDING` with bound `authorizationRowId` / `authorizationVersion`.
4. Seed all `READINESS_CHECK_CODES` as required `PENDING` checks.
5. Audit `p7.activation.evaluation.created`.

Create does **not** launch a workflow. Evaluation runs only via `p710.readiness.evaluate`.

## Evaluate workflow

`RequestReadinessEvaluateUseCase` → definition `p710.readiness.evaluate`, workflow type `readiness.evaluate`.

| Step key | Handler | Effect |
|----------|---------|--------|
| `validate_auth` | `readiness.validate_auth` | Revalidate P7.1; write `auth.p71_revalidated` |
| `check_infra` | `readiness.check_infra` | READY infra resource or committed/validated plan |
| `check_keycloak` | `readiness.check_keycloak` | READY/ACTIVE/VERIFIED topology |
| `check_configuration` | `readiness.check_configuration` | DEPLOYED configuration assignment |
| `check_entitlements` | `readiness.check_entitlements` | DEPLOYED entitlement deployment on assignment |
| `check_experience` | `readiness.check_experience` | READY experience assignment |
| `check_product_control` | `readiness.check_product_control` | ACTIVE product-control endpoint for product |
| `aggregate` | `readiness.aggregate` | Score + blocking codes; set evaluation READY/NOT_READY |

Missing prior-phase ports → required check **FAILED** (fail-closed), not skipped success.

## Aggregate rules

`aggregateReadinessChecks` (`activation-policy.ts`):

- All required checks must be `PASSED`.
- FAILED / BLOCKED / ERROR / PENDING / SKIPPED required checks are blocking.
- On READY, optional bound Activation Record may move to `READY_FOR_ACTIVATION`.

## What this is not

- Not P1 `/edge/readiness` commercial product readiness.
- Not P6 payment activation.
- Not a grant of P5 entitlements.
- Not authority to set commercial `Subscription.ACTIVE`.

## Console mapping

Technical console route: **`/edge/provisioning/readiness`**.  
API under `/edge/activation/evaluations…`. Read gated by `platform:activation:read`.
