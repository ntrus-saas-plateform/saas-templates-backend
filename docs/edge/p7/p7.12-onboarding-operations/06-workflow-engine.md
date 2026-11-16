# P7.12 — Workflow Engine

Mutative operations launch published definitions via `ensureOnboardingDefinition`:

| Kind | Code | Handlers (ordered) |
|------|------|--------------------|
| start | `p712.onboarding.start` | revalidate → require_activation → materialize → mark_started → verify |
| advance | `p712.onboarding.advance` | revalidate → advance_step → verify |
| approve | `p712.onboarding.approve` | revalidate → apply_task_decision → verify |
| reject | `p712.onboarding.reject` | revalidate → apply_task_decision → verify |
| close | `p712.onboarding.close` | revalidate → mark_closed → verify |

Live executor: `ONBOARDING_LIVE_EXECUTOR` (8th) registered in `WorkflowHandlerRegistry`.

Handlers fail-closed without live executor. Compensation → `WAITING_APPROVAL` (never silent close / CRM invent).

`gateMutation` validates lease (when present) then P7.1 revalidation before every mutation.
