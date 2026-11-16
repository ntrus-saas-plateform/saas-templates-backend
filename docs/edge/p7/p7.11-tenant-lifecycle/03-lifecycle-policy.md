# P7.11 — Lifecycle Policy

Location: `domain/tenant-lifecycle/lifecycle-policy.ts`

## Transition guards

| Guard | Rule |
|-------|------|
| `canRequestSuspend` | Status must be `ACTIVE` (→ SUSPENDING) |
| `canRequestResume` | Status must be `SUSPENDED` (→ RESUMING) |
| `canRequestDeprovision` | Flags `authorized===true && confirmed===true`, non-empty `reason`, `exportEvidenceRef` (default required), `deletion_protection` blocks without flags, not already terminal, allowable from ACTIVE/SUSPENDED/FAILED/ARCHIVED |
| `assertTransition` | Explicit from→to matrix for mark_* handlers |

## Fail-closed

- Missing flags on deprovision → `FLAGS_REQUIRED` / `WAITING_APPROVAL` in executor.
- Missing export evidence → `EXPORT_EVIDENCE_REQUIRED`.
- `deletion_protection` without flags → `DELETION_PROTECTED`.
