# P7.12 — Onboarding Policy

Location: `domain/onboarding/onboarding-policy.ts`

## Transition guards

| Guard | Rule |
|-------|------|
| `canRequestStart` | Status must be `PENDING` (→ STARTING) |
| `canRequestAdvance` | Status must be `IN_PROGRESS` / `FAILED` / `STARTING` (not WAITING_APPROVAL) |
| `canRequestClose` | All **required** steps PASSED (or SKIPPED); journey not terminal |
| `canDecideTask` | Task OPEN + journey WAITING_APPROVAL/IN_PROGRESS + **`authorizationRevalidated===true`** |
| `assertJourneyTransition` | Explicit from→to matrix for mark_* handlers |
| `pickNextAdvanceableStep` | First required READY/PENDING by `stepOrder` |

## Fail-closed

- Human approve/reject without P7.1 revalidation → `HUMAN_APPROVAL_CANNOT_BYPASS_AUTH`.
- Close with incomplete required steps → `STEP_NOT_READY`.
- Missing live executor → `PROVIDER_UNAVAILABLE` (never simulate success).
