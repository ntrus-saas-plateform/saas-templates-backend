# P7.10 — Activation Policy

## Location

`domain/readiness-activation/activation-policy.ts`  
Consumed by the live executor aggregate step and evaluation seeding (`mapCheckCodeToPhase`).

## Aggregate readiness

`aggregateReadinessChecks`:

| Condition | Result |
|-----------|--------|
| All required checks `PASSED` | `evaluationStatus=READY`, proposes `READY_FOR_ACTIVATION`, `ready=true` |
| Any required check not PASSED | `evaluationStatus=NOT_READY`, `activationStatus=null`, blocking codes listed |
| No required checks | Score `0`, not ready (fail-closed empty set) |

SKIPPED required checks **block** (fail-closed). Optional failed checks do not block.

## Phase mapping

| Check code | Phase |
|------------|-------|
| `auth.p71_revalidated` | `P71_AUTH` |
| `infra.resources_ready` | `P76_INFRA` |
| `keycloak.topology_verified` | `P77_KEYCLOAK` |
| `configuration.deployed` | `P78_CONFIGURATION` |
| `entitlements.deployed` | `P78_ENTITLEMENTS` |
| `experience.ready` | `P79_EXPERIENCE` |
| `product_control.reachable` | `P75_PRODUCT_CONTROL` |
| `aggregate.ready` | `AGGREGATE` |
| unknown | `OTHER` |

## Fail-closed authorization (O3 trust material)

Before mutations, the live executor requires:

- Authorization port present
- Bound `authorizationRowId` + `authorizationVersion` present — else `TRUST_MATERIAL_MISSING`
- `revalidateBoundAuthorization` succeeds within timeout — else `AUTHORIZATION_FAILED` / timeout deny
- Identity match on returned view

Per prior-phases audit **O3**: P7.1 G1/P5 production trust material may be pending; activation **must remain fail-closed** without it. Never best-effort activate.

## Activation preconditions

`RequestTechnicalActivationUseCase` / `activation.require_ready_evidence`:

- Bound P7.1 auth revalidated.
- Bound readiness evaluation exists and status is `READY` (HTTP launch and workflow both enforce).
- Technical ACTIVE is set only on the Activation Record (`activation.mark_active`), never by inventing commercial subscription ACTIVE.

## Hard exclusions

| Forbidden as technical gate | Rationale |
|-----------------------------|-----------|
| P6 payment activation | Commercial payment path — out of scope |
| P1 commercial readiness board | Different product surface (`/edge/readiness`) |
| Commercial readiness score as substitute for checks | Technical checks are SoT for READY |
