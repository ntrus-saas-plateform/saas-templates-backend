# 32 — Evidence tests

**Campagne :** certification enterprise P8  
**Date :** 2026-11-16  
**Migrations :** `108`, `112`, `113`

## E2 (unitaire)

- `src/modules/edge/domain/tenant-management/tenant-management-policy.spec.ts`
- `src/modules/edge/application/tenant-management/tenant-management.use-cases.spec.ts`
- `src/modules/edge/presentation/controllers/tenant-management.controller.auth.spec.ts`

Commande : `npx vitest run` (include `src/**/*.spec.ts`).

## E3 (Testcontainers)

Fichier : `test/integration/edge-p8-tenant-management-transactional.spec.ts`

- `describe.skipIf(!runTestcontainers)`
- Migrations control-plane via `applyControlPlaneMigrations` (incl. `113`)
- Cas : register/search · legal hold preserve · reconciliation ON_DEMAND · audit+outbox · lift SoD deux acteurs

Commande (exécutée localement avec Docker) :

`TESTCONTAINERS=true npx vitest run --config vitest.config.integration.ts test/integration/edge-p8-tenant-management-transactional.spec.ts`

**Résultat campagne : 5/5 PASS**

## E4-lite (adversarial)

Fichier : `test/security/edge-p8-tenant-management-adversarial.spec.ts`

SoD lifecycle/exception/migration/legal-hold-lift · bulk preview count · bulk requester · HEALTHY source · EXPORT bulk rejeté.

Commande : `npx vitest run --config vitest.config.security.ts`

## Charge (smoke)

Fichier : `test/load/edge-p8-registry-search-scale.spec.ts`

1000 lignes `edge_p8_tenants` · recherche `q` + limit 50 · assertion &lt; 5000 ms (durée mesurée dans message d’assertion).

Commande : `TESTCONTAINERS=true npx vitest run --config vitest.config.load.ts test/load/edge-p8-registry-search-scale.spec.ts`

**Résultat campagne : 1/1 PASS**

## Non exécuté

- E2E navigateur multi-utilisateur
- E3 sans `TESTCONTAINERS=true` (suite skipped — ne pas compter comme preuve)