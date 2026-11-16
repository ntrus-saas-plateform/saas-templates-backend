# P7.13 — Test Evidence

## Backend

| Suite | Focus |
|-------|-------|
| `reconciliation-policy.spec.ts` | UNKNOWN≠MISSING; waiver expiry; unsafe auto-remediate deny; approve requires P7.1 |
| `reconciliation.controller.auth.spec.ts` | Permission metadata on all endpoints |

## Frontend

| Suite | Focus |
|-------|-------|
| `edge-reconciliation-module.test.tsx` | Forbidden without read; no invented REMEDIATED; UNKNOWN detail + observe/remediate controls |

## Commands

```bash
# backend
npx tsc --noEmit
npx vitest run src/modules/edge/domain/reconciliation src/modules/edge/presentation/controllers/reconciliation.controller.auth.spec.ts

# frontend
npx vitest run components/edge/reconciliation
```

Counts recorded in `12-acceptance-report.md` after execution.
