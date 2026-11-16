# P7.7 — Test Evidence

**Date:** 2026-11-16 · **Branch:** `feature/console` · Counts from executed runs only.

## Matrix

| # | Suite | Command | Result |
|---|-------|---------|--------|
| 1 | Backend unit | `npx vitest run` | **861 / 861 passed** |
| 2 | Backend security | `npx vitest run --config ./vitest.config.security.ts` | **89 / 89 passed** |
| 3 | Backend integration DB | `$env:TESTCONTAINERS='true'; npx vitest run --config ./vitest.config.integration.ts test/integration/edge-keycloak-topology-db.spec.ts` | **7 / 7 passed** (prior run; schema unchanged) |
| 4 | Backend live Keycloak | `$env:TESTCONTAINERS='true'; npx vitest run --config ./vitest.config.integration.ts test/integration/edge-keycloak-live.spec.ts` | **12 / 12 passed** — `quay.io/keycloak/keycloak:26.0.7`, `start-dev --features=organization` |
| 5 | Backend typecheck | `npx tsc --noEmit` | **0 errors** |
| 6 | Frontend working tree | `git status` on `feature/console` | **clean** @ `d7dcb2eb…` |

## Live Keycloak — `edge-keycloak-live.spec.ts` (12, KC 26.0.7)

| # | Test | Result |
|---|------|--------|
| 1 | Capabilities discovery (`organizationsSupported=true`) | PASS |
| 2 | Realm create idempotent re-adopt | PASS |
| 3 | Technical client secret-once | PASS |
| 4 | OIDC discovery | PASS |
| 5 | Organization probe | PASS |
| 6 | SSRF hostile realm → 404 on registered origin | PASS |
| 7 | Health leak-free | PASS |
| 8 | `redactSensitive` | PASS |
| 9 | **§4 REAL technical organization** (create, read-back id+alias, idempotent adoption, evidence, no business identities) | PASS |
| 10 | **§4 partial-failure recovery** (external org exists, internal state cleared → adopt, no duplicate) | PASS |
| 11 | **§1 live revocation between steps** (DENY evidence, zero provider calls) | PASS |
| 12 | **§5 live reconciliation** (drift → remediate → NO_DRIFT → outage fail-closed → recover; no createRealm/org/client) | PASS |

## Security — P7.1 / P7.4 remediation harness

- `test/security/edge-keycloak-p71-p74.spec.ts` (+ harness): denied authorization cases assert **zero** Keycloak mutation calls; stale-worker fencing rejects worker A after B reclaim.
- `keycloak.controller.routing.spec.ts`: reconcile launches `p77.keycloak.topology.reconcile` with `validate_plan` → `reconcile_topology` only.

## Defects found during remediation (and fixed)

| Defect | Fix |
|--------|-----|
| Snapshot-flag authorization | Canonical P7.1 port in live executor |
| Self-compared fencing token | `RepositoryWorkflowLeaseValidator` |
| Wrong reconcile definition | Controller + definitionCode match |
| Org feature probe false negative (master realm 404 “not enabled”) | FeatureRepresentation parse + per-realm `organizationsEnabled` |
| Org create HTTP 400 (domain required) | Technical `*.edge.internal` domain |
| Realm settings PUT 400 | Full realm GET + normalized KC 26 patch |
| Dependents stuck PENDING | `listSteps` on TX client |
| Audit UUID vs worker id | `requireAudit` UUID sanitize |
| Definition version missing in open TX | Use `created.version` from insert |

## Remaining gaps

| Gap | Note |
|-----|------|
| Model C live | No certified external adapter in lab |
| Remote push | May still be HTTP 403 — report exact error, do not claim publication |
