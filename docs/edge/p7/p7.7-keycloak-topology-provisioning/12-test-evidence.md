# P7.7 — Test Evidence

**Date:** 2026-11-12 · **Branch:** `feature/console` · All counts below are from executed runs (no inferred results).

## Matrix

| # | Suite | Command | Result |
|---|-------|---------|--------|
| 1 | Backend unit | `npx vitest run --config ./vitest.config.ts` | **855 / 855 passed** |
| 2 | Backend security | `npx vitest run --config ./vitest.config.security.ts` | **58 / 58 passed** (incl. the 12 P7.7 tests below) |
| 3 | Backend integration DB | `$env:TESTCONTAINERS='true'; npx vitest run --config ./vitest.config.integration.ts test/integration/edge-keycloak-topology-db.spec.ts` | **7 / 7 passed** |
| 4 | Backend live Keycloak | `$env:TESTCONTAINERS='true'; npx vitest run --config ./vitest.config.integration.ts test/integration/edge-keycloak-live.spec.ts` | **8 / 8 passed** — `quay.io/keycloak/keycloak:26.0.7`, `start-dev --features=organization` |
| 5 | Backend typecheck | `npx tsc --noEmit` | **0 errors** |
| 6 | Backend lint | project lint (0 errors; warnings only, incl. 2 pre-existing-style warnings in `keycloak-admin.adapter.ts`) | **0 errors** |
| 7 | Frontend unit | frontend `npx vitest run` | **120 / 120 passed** (22 files), incl. 6 Keycloak module tests |
| 8 | Frontend typecheck | frontend `tsc` | **0 errors in P7.7 files** (`lib/api/edge.ts` + keycloak files); **85 pre-existing errors in untouched files** |

## Suite contents

### Security — `test/security/edge-keycloak-security.spec.ts` (12)

| Group | Tests |
|-------|-------|
| SSRF origin guard (5) | discovery always built from registered origin (hostile realm names ×3 stay on origin); plain http refused on non-loopback; loopback http allowed for lab; redirect wildcard/`null`/template policy; `conn.baseUrl` never mutated |
| Secret masking (2) | `redactSensitive` for Bearer / `client_secret=` / JSON forms; vault stores encrypted and returns material only by `sec_` ref |
| Fencing (2) | stale/missing token rejected **before** the executor runs (execute path); valid token reaches executor |
| P7.1 fail-closed (3) | revoked/expired authorization blocks plan; no-authorization defaults refused; realm identity Edge-derived (metadata endpoint input never leaks into realm name) |

### Integration DB — `test/integration/edge-keycloak-topology-db.spec.ts` (7 tests, PostgreSQL 16 Testcontainer)

Setup assertions (`beforeAll`): migration 102 applied (`applied` contains `102_edge_p7_keycloak_topology_provisioning`) and **all 14 tables** present; seeded `keycloak-managed-v1` provider found. The 7 tests:

1. Topology persists with distinct internal vs external identity, `version = 1`, optimistic-lock rejection on stale version.
2. Active-topology uniqueness (second create for same tenant/product/server rejects).
3. Only opaque `sec_` credential refs stored; serialized rows contain no `client_secret`/`password`.
4. Capability discovery persisted atomically (`26.0.7`, organizations supported).
5. Operation evidence + history persisted and listable.
6. Reconciliation runs with drift classification (`PENDING → QUARANTINED`).
7. Schema guard: secret/credential columns must end `_ref` / `_rotated_at` — no plaintext secret column.

### Live Keycloak — `test/integration/edge-keycloak-live.spec.ts` (8, KC 26.0.7)

1. Capabilities discovery via authenticated `serverinfo` (`isVersionAtLeast(26,0)`).
2. Realm create idempotent: second call re-adopts same external id (reconcile-before-create).
3. Confidential technical client: secret returned **once**; idempotent re-create returns same external id and **no** secret.
4. Real OIDC discovery for the provisioned realm (issuer contains `/realms/{realm}`).
5. Organization probe never throws against a healthy server (boolean observation).
6. SSRF: hostile realm names resolve to `404` on the registered origin.
7. `health()` authenticated and leak-free (serialized output contains no test secrets).
8. `redactSensitive` scrubs tokens/secrets from arbitrary text.

### Frontend — `components/edge/keycloak/edge-keycloak-module.test.tsx` (6)

Renders servers without credential values · forbidden state without `platform:keycloak:read` · topology detail with masked secret (`••••••••`, raw ref never rendered) · health + evidence rendered · history tab hidden without `history:read` · reconcile only after explicit user action.

## Defects found & fixed (documented in `07`)

| # | Defect | Found by | Status |
|---|--------|----------|--------|
| 1 | KC 26 rejects `ssoSessionIdle`/`ssoSessionMax` (HTTP 400 `unable to read contents from stream`) | Live realm create | Fixed: `ssoSessionIdleTimeout` / `ssoSessionMaxLifespan` (`buildRealmPayload` + `fingerprintRealm`) |
| 2 | Fencing token 0/negative/null not rejected | Security review + suite | Fixed: `isValidFencingToken` integer `>= 1`, fail-closed |
| 3 | Stale cached admin token lacked new realm's admin roles ⇒ 403 on realm-scoped calls after create | **Live suite only** | Fixed: `invalidateToken(conn)` after create, before verification probe |
| 4 | jsdom `scrollIntoView` TypeError | Frontend vitest | Fixed: `beforeAll` polyfill |

## Not executed (honest gaps)

| Gap | Note |
|-----|------|
| Model B organization **creation** end-to-end on live Keycloak | Test container enables `--features=organization`, but the live suite exercises only the **probe** (`organizationExists` boolean); `createOrganization` has no executed live test |
| Model C (`EXTERNAL_SPECIFIC`) live | Executor records `SKIPPED` for certified-adapter topologies; no external adapter available to test |
| Live reconciliation cycle against a real server | Covered by unit/DB suites only |
| HTTP smoke test of the P7.7 controller endpoints | Not part of the executed matrix (controller covered by DTO validation + unit suites) |
