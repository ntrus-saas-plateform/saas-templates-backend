# P7.2 — Preuves de tests (audit remediation)

**Date preuves :** 2026-11-10  
**Branche :** `feature/console`  
**Mandat :** P7.2 AUDIT REMEDIATION (atomicité TX, fail-closed compat, DTO, 097, FE/API)

## 1. Tests domain / application (registry)

```bash
npm run test:edge:registry
npx vitest run src/modules/edge/presentation/dto/registry.dto.spec.ts src/modules/edge/presentation/controllers/registry.controller.auth.spec.ts
npx vitest run src/modules/edge/domain/registry/compatibility-engine.spec.ts
```

| Suite | Exit | Résumé |
|-------|------|--------|
| `test:edge:registry` (domain+application+infra registry) | **0** | **4** files / **74** tests passed |
| DTO + auth controller specs | **0** | **2** files / **22** tests passed |
| Compatibility engine alone | **0** | **58** tests passed (inclus dans les 74) |

Couverture remédiation :
- Atomicité use-cases via `runWithOutbox` (client partagé mutation/history/audit/outbox)
- Fail-closed : listes vides → `REQUIRES_REVIEW` ; mismatch → `INCOMPATIBLE`
- Anti auto-certification profil sur `ACTIVE`
- DTO class-validator (UUID, enums, longueurs, expectedVersion, propriétés inconnues)
- Authz `@RequireEdgePermissions` + guard forbid/allow

## 2. Tests PostgreSQL transactionnels

```bash
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-registry-transactional.spec.ts
```

| Champ | Valeur |
|-------|--------|
| Exit code | **0** |
| Résumé | **1** file / **5** tests passed |
| Preuves | happy path 4 écritures ; rollback échec audit ; rollback échec outbox ; rollback échec history ; conflit `expectedVersion` |

## 3. Tests API authentifiés (permissions réelles)

```bash
npx vitest run src/modules/edge/presentation/controllers/registry.controller.auth.spec.ts
```

| Champ | Valeur |
|-------|--------|
| Exit | **0** |
| Preuve | métadonnées permissions par endpoint + `EdgePermissionGuard` deny sans permission / allow avec permission |

## 4. Tests frontend

```bash
npm test -- --run lib/edge/registry.test.ts components/edge/registry/shared.test.tsx "app/(edge-console)/edge/provisioning/registry"
```

| Champ | Valeur |
|-------|--------|
| Exit | **0** |
| Résumé | **4** files / **23** tests passed |
| Note | `lib/edge/registry.test.ts` = helpers uniquement ; couverture UI réelle dans `shared.test.tsx`, `registry-page.test.tsx`, `registry-detail.test.tsx` (onglets, CRUD mock, certify/deprecate, filtres/pagination, permissions, erreurs API, opaque `secureConfigRef`, badges compatibilité) |

## 5. Typecheck backend

```bash
npm run typecheck
```

| Champ | Valeur |
|-------|--------|
| Exit | **0** |

## 6. Typecheck frontend

```bash
npx tsc --noEmit
```

| Champ | Valeur |
|-------|--------|
| Exit | **1** (dettes préexistantes hors registry) |
| Erreurs liées registry / provisioning registry | **0** (filtre `registry` vide) |
| Erreurs totales préexistantes (sales/subscriptions/identity) | **50** |

## 7. Lint

```bash
npx oxlint src/modules/edge/domain/registry src/modules/edge/application/registry src/modules/edge/infrastructure/registry src/modules/edge/presentation/dto/registry.dto.ts src/modules/edge/presentation/controllers/registry.controller.ts src/modules/edge/infrastructure/persistence/pg-audit-event.repository.ts test/integration/edge-registry-transactional.spec.ts
```

| Champ | Valeur |
|-------|--------|
| Exit scoped registry | **0** |
| Lint global `npm run lint` | **1** — erreur préexistante UTF-8 `sales.entity.ts` (hors périmètre remediation) |

## 8. Migrations PostgreSQL éphémère

```bash
docker run -d --name p72-pg-remed -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=platform_control -p 55433:5432 postgres:16-alpine
CONTROL_PLANE_DB_HOST=127.0.0.1 CONTROL_PLANE_DB_PORT=55433 ... npm run migrate:control
```

| Champ | Valeur |
|-------|--------|
| Exit | **0** |
| Preuve | `Applied 096_edge_p7_product_platform_runtime_registry` + `Applied 097_edge_p7_deployment_profile_certification_remediation` + `Control plane migrations complete` |

Vérification SQL post-097 :

```text
SHARED_SAAS       | UNCERTIFIED | ACTIVE | AVAILABLE_DOCUMENTED
DEDICATED_DATA    | UNCERTIFIED | ACTIVE | AVAILABLE_DOCUMENTED
DEDICATED_RUNTIME | UNCERTIFIED | ACTIVE | AVAILABLE_DOCUMENTED
PRIVATE_CLOUD     | UNCERTIFIED | DRAFT  | AVAILABLE_DOCUMENTED
ON_PREMISE        | UNCERTIFIED | DRAFT  | AVAILABLE_DOCUMENTED
```

## 9. Smoke API authentifié

| Mode | Statut | Preuve |
|------|--------|--------|
| Authz Nest (permissions registry) | **PASS** | `registry.controller.auth.spec.ts` |
| HTTP live Bearer contre API locale | **NOT RUN** | aucun listener `liveness` sur `:3000`/`:3001` au moment des preuves — **ne pas déclarer PASS live** |

## 10. Non-régression P7.1

```bash
npm run test:edge:provisioning
```

| Champ | Valeur |
|-------|--------|
| Exit | **0** |
| Résumé | **11** files / **55** tests passed |

## Synthèse exécution

| # | Preuve | Verdict |
|---|--------|---------|
| 1 | Domain/application registry | **PASS** |
| 2 | TX PostgreSQL | **PASS** |
| 3 | API authz | **PASS** |
| 4 | Frontend | **PASS** |
| 5 | Typecheck BE | **PASS** |
| 6 | Typecheck FE (scope registry) | **PASS** (global FAIL dette préexistante) |
| 7 | Lint scoped | **PASS** |
| 8 | Migrate 096+097 éphémère | **PASS** |
| 9 | Smoke HTTP live | **NOT RUN** |
| 10 | Non-régression P7.1 | **PASS** |
