# 36 — Fermeture résiduels P8

**Date :** 2026-11-16  
**Branche :** `feature/console`  
**Migration :** `114_edge_p8_residual_enterprise_closure`

## Verdict

**ACCEPTED — ENTERPRISE READY** (résiduels de la campagne 35 fermés).

## Fermetures

| Résidu (§35 / findings) | Remédiation | Preuve |
|-------------------------|-------------|--------|
| Dual RAISE legal hold | Direct `UpdateLegalHold` interdit pour RAISE et LIFT ; workflow SoD obligatoire | E2 + E3 |
| E2E navigateur | Playwright smoke `/edge/tenants` + CSRF multi-route | `e2e/edge-tenants-smoke.spec.ts` |
| Deprovision flag-gated opaque | API/UI `deprovision-authorization` + permission dédiée | E2 auth + FE |
| Bridge P7 FAILED soft | Fail-closed : approve non persisté | E2 + E4-lite chaos |
| Scale 1k | 10k rows + indexes `pg_trgm` GIN ; SLO &lt; 3000 ms | load 1/1 |
| IDOR / F09 portfolio | `scope:global` + `edge_p8_operator_scopes` + enforce get/search/export | E2 + E3 |
| P5 live F03 | Vérif `edge_subscriptions.status` (ACTIVE/TRIALING/PAST_DUE) | E2 register path |

## Preuves rejouées

| Suite | Résultat |
|-------|----------|
| Unit/auth P8 | **81 passed** |
| E4-lite adversarial | **11 passed** |
| E3 Testcontainers | **6/6 passed** (incl. dual RAISE/LIFT + operator scope) |
| Load 10k | **1/1 passed** (~44 ms search) |
| FE tenant-management | **6 passed** |

## Gates

| Gate | Statut |
|------|--------|
| D Ops / P7 exec | **PASS** (authorize API + fail-closed bridge) |
| G Résilience/perf | **PASS** (chaos FAILED + 10k) |
| H E3/E4 | **PASS** |
| I Conformité | **PASS** (dual RAISE + scope object-level) |
| J Certification | **ACCEPTED** |
