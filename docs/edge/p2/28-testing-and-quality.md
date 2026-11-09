# P2 testing & quality

## Unit (PASS)
```bash
npx vitest run src/modules/edge/domain/commercial src/modules/edge/application/commercial
```
Covers ownership, capability inclusion gates, readiness, pricing decimal math, configurator eligibility, value-prop evidence gate.

## Integration DB (PASS with RUN_TESTCONTAINERS=1)
```bash
npx vitest run --config vitest.config.integration.ts test/integration/edge-commercial-db.spec.ts
```
Applies migrations through `075`, asserts commercial tables, non-negative price constraint, commercial permission seeds, **no invented seed prices**.

`edge-db-qualification.spec.ts` updated so latest migration is `075_edge_commercial_foundation.sql` and upgrade path expects 075.

## Playwright smoke (PASS)
Frontend:
```bash
npx playwright test e2e/edge-commercial-smoke.spec.ts
```
- Anonymous `/edge/commercial` gate
- CSRF rejection on pricing preview + plan publish

## Scenarios A–F
Domain/DB (Testcontainers):
```bash
npx vitest run --config vitest.config.integration.ts test/integration/edge-commercial-scenarios.spec.ts
```
Covers build/readiness/publish/geo books/enterprise deployment/vertical isolation/snapshot immutability.

Playwright CSRF contract + gated authenticated UI:
```bash
npx playwright test e2e/edge-commercial-scenarios.spec.ts
# Authenticated UI (see saas-template-frontend/docs/edge-e2e-auth.md):
# EDGE_E2E_AUTH=1 EDGE_E2E_USERNAME=... EDGE_E2E_PASSWORD=... pnpm test:e2e -- e2e/edge-commercial-scenarios.spec.ts
```

## Not executed
Authenticated UI end-to-end A–F (build offer → readiness → publish in console) — blocked on Edge Keycloak fixture + published P1 product seed in CI (`EDGE_E2E_AUTH`).
