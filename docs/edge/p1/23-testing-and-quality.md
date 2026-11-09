# Testing & Quality (P1.21)

## Executed

| Suite | Command | Result |
|-------|---------|--------|
| Backend typecheck | `pnpm typecheck` | PASS |
| Edge domain unit | `pnpm exec vitest run src/modules/edge/domain` | PASS |
| Product vertical isolation unit | `pnpm exec vitest run src/modules/edge/application/product src/modules/edge/domain/product` | see release report |
| Catalog DB (Testcontainers) | `TESTCONTAINERS=true … edge-catalog-db.spec.ts` | PASS (2/2) |
| Frontend unit | `pnpm test` (edge-frontend) | PASS (24) |

## Authz coverage (P1)

Unit coverage for:

- Global vs workspace product create/update/read
- Cross-vertical list filter rejection
- Restaurant admin cannot mutate Pharmacy product

Full HTTP authorization matrix (10 personas × scenarios A–E) remains for integration harness with Keycloak fixtures — mark NOT_EXECUTED until harness available.

## E2E

Authenticated Playwright catalog publish flow (Scenario A) — NOT_EXECUTED without Edge login fixtures in CI.

## Regression

P0 Edge IAM / workspace / BFF must remain green; P1 must not declare READY_FOR_STAGING while P0-H.2–H.8 are open.
