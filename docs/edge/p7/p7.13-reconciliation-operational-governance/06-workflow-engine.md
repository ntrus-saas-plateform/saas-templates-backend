# P7.13 — Workflow Engine Integration

## Definitions

| Code | Steps |
|------|-------|
| `p713.reconciliation.observe` | revalidate_auth → collect_desired → collect_observed → classify_findings → apply_waivers → plan_remediation → verify |
| `p713.reconciliation.remediate` | revalidate_auth → execute_remediation → verify |

## Live executor

`RECONCILIATION_LIVE_EXECUTOR` is the **9th** Nest live executor, registered in `WorkflowHandlerRegistry` alongside P7.5–P7.12.

Handlers fail-closed if executor missing (no simulation).

## Lease / fencing

Executor validates `WorkflowLeasePort` when present (same pattern as P7.12).

## Compensation

Handler compensation returns `WAITING_APPROVAL` — never silent delete.
