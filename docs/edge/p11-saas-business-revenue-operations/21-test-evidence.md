# 21 — Test evidence

Record command outputs here when suites are run locally.

### Backend (domain)

```
pnpm vitest run src/modules/edge/domain/revenue-operations
```

### Frontend (module)

```
pnpm vitest run components/edge/revenue-operations/edge-revenue-module.test.tsx
```

### Playwright smoke

```
pnpm exec playwright test e2e/edge-revenue-smoke.spec.ts
```

### Recorded (2026-11-16)

Frontend module vitest:

```
pnpm vitest run components/edge/revenue-operations/edge-revenue-module.test.tsx
# Test Files  1 passed (1)
# Tests  5 passed (5)
```

Playwright smoke and backend domain suites: run separately; do not invent green results.
