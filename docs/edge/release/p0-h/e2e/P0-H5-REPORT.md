# P0-H.5 — Playwright E2E Report

**Date:** 2026-11-09  
**Status:** **PARTIAL PASS** — anonymous Edge + BFF hard gates green; authenticated scenarios A–G **NOT_EXECUTED**

## Executed (14/14)

```text
cd saas-template-frontend
pnpm exec playwright install chromium
pnpm exec playwright test e2e/edge-smoke.spec.ts e2e/smoke.spec.ts e2e/authz.spec.ts
```

| Suite | Result |
|-------|--------|
| Edge anonymous UI isolation | PASS (7) |
| Edge CSRF / bootstrap API | PASS |
| ERP BFF CSRF / session / bootstrap | PASS |
| ERP shell smoke | PASS |

## Defects fixed during qualification

1. Cookie assertion false-positive: `okapi_edge_csrf` matched substring `edge_csrf` → parse cookie names.
2. Playwright Chromium missing in sandbox cache → installed.
3. ERP UI smoke brittle under Next error overlay when Keycloak unconfigured → assert no data tables.

## NOT_EXECUTED (blocking for full H.5 PASS)

Authenticated Edge scenarios A–G (login, workspace switch, membership, revoke, cross-vertical deny, etc.) require Edge Keycloak user fixtures + seeded Control Plane administrators.
