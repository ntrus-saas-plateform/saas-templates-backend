# P7.12 — Domain Model

## Aggregates

| Aggregate | Role |
|-----------|------|
| **OnboardingTemplate** | Reusable step plan (DRAFT → PUBLISHED) |
| **OnboardingJourney** | SoT for operational journey status; binds P7.1 auth + P7.10 Activation Record |
| **OnboardingStep** | Ordered steps from template or DEFAULT_ONBOARDING_STEP_PLAN |
| **OnboardingTask** | Human approval tasks (OPEN → APPROVED/REJECTED) |
| **OnboardingRun** | One START / ADVANCE / APPROVE / REJECT / CLOSE / VERIFY attempt |
| **OnboardingEvidence** | Durable step-level evidence (append-only) |
| **OnboardingHistory** | Status / action history |

## Status machine (summary)

Journey: `PENDING → STARTING → IN_PROGRESS ⇄ WAITING_APPROVAL → CLOSING → CLOSED`  
Also: `BLOCKED`, `FAILED`, `CANCELLED`, `SUPERSEDED`.

Partial unique index: one non-terminal journey per tenant×product.

## Handler keys

See `ONBOARDING_HANDLER_KEYS` in `onboarding.types.ts` — revalidate, require_activation_active, materialize_steps, mark_started, advance_step, open_human_task, apply_task_decision, coord_verify, handover, mark_closed, verify.

## Error codes

`VALIDATION`, `AUTHORIZATION_FAILED`, `ACTIVATION_NOT_ACTIVE`, `TEMPLATE_NOT_PUBLISHED`, `JOURNEY_FORBIDDEN`, `STEP_NOT_READY`, `APPROVAL_REQUIRED`, `HUMAN_APPROVAL_CANNOT_BYPASS_AUTH`, `CONFLICT`, `PROVIDER_UNAVAILABLE`.

## Persistence

Migration **107** (`107_edge_p7_onboarding_operations.sql`):

- `edge_p7_onboarding_templates`
- `edge_p7_onboarding_journeys`
- `edge_p7_onboarding_steps`
- `edge_p7_onboarding_tasks`
- `edge_p7_onboarding_runs`
- `edge_p7_onboarding_history`
- `edge_p7_onboarding_evidence`
