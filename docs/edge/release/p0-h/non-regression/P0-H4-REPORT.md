# P0-H.4 — ERP / Edge Non-Regression Report

**Date:** 2026-11-09  
**Status:** **PASS** (isolation + architecture + smoke)

## Evidence

| Control | Result |
|---------|--------|
| Edge domain boundary (no Nest/pg/identity imports) | PASS (`edge-boundary.spec.ts` 2/2) |
| ERP JWT still requires `tenant_id` | PASS (`jwt-validation.service.spec.ts`) |
| Edge JWT never requires `tenant_id` | PASS |
| Cookie names isolated (`okapi_edge_*` vs `edge_*`) | PASS (Playwright + unit session tests) |
| CSRF independent (ERP vs Edge) | PASS |
| Edge console anonymous ≠ ERP Org Switcher | PASS (`edge-smoke` UI) |
| ERP org deep-link does not leak data tables when unauth | PASS |

## Command

```text
pnpm exec playwright test e2e/edge-smoke.spec.ts e2e/smoke.spec.ts e2e/authz.spec.ts
→ 14 passed
```

## Residual

- Full ERP integration suite against upgraded Control Plane container: NOT_EXECUTED in this run (H.1 upgrade preserves tenant/org fixtures)
- Authenticated ERP Org Switcher live against Keycloak `platform`: NOT_EXECUTED (local frontend ERP Keycloak env unconfigured)
