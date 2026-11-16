# 24 — Test evidence

**Date:** 2026-11-16  
**Branch:** `feature/console`  
Also see [21-test-evidence.md](./21-test-evidence.md).

## Backend (vitest)

```text
npx vitest run src/modules/edge/domain/revenue-operations src/modules/edge/application/revenue-operations src/modules/edge/presentation/controllers/revenue-operations.controller.auth.spec.ts
```

**Result: 9 files / 93 tests passed**

Highlights: MRR/ARR helpers; GRR excludes expansion; NRR; assurance detectors; unit economics null-on-missing; renewal risk; forecast scenario isolation; auth matrix.

## Frontend (vitest)

```text
npx vitest run components/edge/revenue-operations
```

**Result: 1 file / 5 tests passed**

## Playwright

`e2e/edge-revenue-smoke.spec.ts` — sign-in gate + CSRF reject (not full financial E2E).

## Not claimed

Testcontainers · full mandated cases 1–72 · live P6 recognized-revenue integration.
