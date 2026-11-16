# P7.13 — Observation UNKNOWN Semantics

## Invariant

> **Timeout / unreachable ⇒ `ObservationClass.UNKNOWN` — NEVER treat as deleted.**

## Rationale

Treating unreachable providers as `MISSING` would drive destructive remediations (recreate/delete) against resources that may still exist. P7.13 fail-closes to `UNKNOWN` and routes to quarantine / re-observe / human approval.

## Executor behavior

| Step | Behavior |
|------|----------|
| `collect_observed` | If `providerUnreachable`, persist snapshot with flag; outcome evidence `UNKNOWN` |
| `classify_findings` | Pass `providerUnreachable: true` into `classifyObservations` → drafts all `UNKNOWN`, `autoRemediateEligible: false` |
| `plan_remediation` | UNKNOWN → plan `QUARANTINE_OR_REOBSERVE`, status `WAITING_APPROVAL` |
| `execute_remediation` | Requires approval; evidence-only; **no foreign destructors** |

## API / console

Observe DTO / UI expose `providerUnreachable` for tests and controlled simulation. Console copy states UNKNOWN ≠ deleted.
