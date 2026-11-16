# P7.12 — Architecture

## Purpose

P7.12 is the **onboarding operations** layer post P7.10 activation. It owns operational templates, journeys, steps, and human tasks for technical handover readiness. It does **not** manage CRM, business user invites/memberships, or set commercial `Subscription.ACTIVE`.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Onboarding Template + Journey bound to ACTIVE Activation Record | CRM / commercial SoT |
| Start / advance / approve / reject / close via P7.4 workflows | Business IAM invites / memberships |
| Fail-closed P7.1 revalidation + lease | Human approval bypassing auth |
| Coordination / verify **signals** + vault-style handover ref | Invoking foreign mutators that need separate workflows |
| Close only when all required steps PASSED | Setting commercial Subscription.ACTIVE |

## Layering

```
Edge Console (/edge/provisioning/onboarding) / API client
  → EdgeOnboardingController (RBAC platform:onboarding:*)
    → Use cases (template/journey create, launch start/advance/decide/close)
      → OnboardingRepositoryPort (Postgres, migration 107)
      → P7.4 workflow engine (definitions p712.onboarding.*)
        → LiveOnboardingExecutor (handlers onboarding.*)
          → ACTIVATION_REPOSITORY_PORT (require ACTIVE)
          → materialize_steps / advance / human task / handover / close
      → P7.1 authorization revalidation (fail-closed)
```

## Hard dependencies

- **P7.10** — Journey create requires Activation Record `ACTIVE`.
- **P7.1** — bound authorization revalidated before create / launch / decide and every handler mutation. Human approval **cannot** bypass auth.
- **P7.4** — mutative start / advance / approve / reject / close only via durable workflows; handlers require live executor (8th).
- **O3** — missing trust material remains fail-closed.

## Workflow definitions

| Code | Intent |
|------|--------|
| `p712.onboarding.start` | revalidate → require activation ACTIVE → materialize steps → mark started → verify |
| `p712.onboarding.advance` | revalidate → advance next READY/PENDING required step → verify |
| `p712.onboarding.approve` | revalidate → apply APPROVE (auth cannot be bypassed) → verify |
| `p712.onboarding.reject` | revalidate → apply REJECT (auth cannot be bypassed) → verify |
| `p712.onboarding.close` | revalidate → mark closed iff all required PASSED → verify |

Advance branching: HUMAN → open task + WAITING_APPROVAL; COORDINATION/VERIFY → evidence PASSED (signal); HANDOVER → `handover_evidence_ref` vault-style.

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md` (addendum: migration **107**).
