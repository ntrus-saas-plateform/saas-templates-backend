# P7.10 — Domain Model

## Aggregates

| Aggregate | Role |
|-----------|------|
| **TenantReadinessEvaluation** | One technical readiness pass for tenant×product (+ optional subscription/account); binds P7.1 auth |
| **ReadinessCheck** | Required/optional check row per evaluation (`check_code` unique per evaluation) |
| **ActivationRecord** | Source of truth for **technical** ACTIVE; binds P7.1 auth + optional evaluation |
| **ActivationRun** | One EVALUATE / ACTIVATE / VERIFY / BLOCK / SUPERSEDE attempt |
| **ActivationEvidence** | Durable step-level evidence (append-only) |
| **ActivationHistory** | Status / action history for evaluations and records |

## Status machines (summary)

**Evaluation:** `PENDING → EVALUATING → READY | NOT_READY | FAILED | BLOCKED`; may become `SUPERSEDED` | `EXPIRED`

**Check:** `PENDING → PASSED | FAILED | SKIPPED | BLOCKED | ERROR`

**Activation Record:** `PENDING → EVALUATING → READY_FOR_ACTIVATION → ACTIVATING → ACTIVE | FAILED | BLOCKED`; may `SUPERSEDED`

`READY_FOR_ACTIVATION` is proposed only when aggregate evaluation is `READY`. Technical `ACTIVE` on the Activation Record is **not** commercial `Subscription.ACTIVE`.

## Required check codes

| Code | Phase |
|------|-------|
| `auth.p71_revalidated` | `P71_AUTH` |
| `infra.resources_ready` | `P76_INFRA` |
| `keycloak.topology_verified` | `P77_KEYCLOAK` |
| `configuration.deployed` | `P78_CONFIGURATION` |
| `entitlements.deployed` | `P78_ENTITLEMENTS` |
| `experience.ready` | `P79_EXPERIENCE` |
| `product_control.reachable` | `P75_PRODUCT_CONTROL` |
| `aggregate.ready` | `AGGREGATE` |

All seeded checks are **required** by default. SKIPPED required checks block readiness (fail-closed).

## Error codes (selected)

`VALIDATION`, `AUTHORIZATION_FAILED`, `TRUST_MATERIAL_MISSING`, `READINESS_NOT_READY`, `EVIDENCE_MISSING`, `CHECK_FAILED`, `P5_SIGNAL_FAILED`, `CONFLICT`, `PROVIDER_UNAVAILABLE`, `ACTIVATION_FORBIDDEN`.

## Persistence

Tables under migration **105** (`105_edge_p7_readiness_activation.sql`):

- `edge_p7_tenant_readiness_evaluations`
- `edge_p7_readiness_checks`
- `edge_p7_activation_records` (partial unique active row per tenant×product)
- `edge_p7_activation_runs`
- `edge_p7_activation_history`
- `edge_p7_activation_evidence`

Permissions `platform:activation:*` seeded in the same migration.
