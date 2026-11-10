# P7.3 — Preuves de tests

**Date :** 2026-11-10  
**Branche :** `feature/console`

## 1. Domain / application / DTO / auth

```bash
npx vitest run src/modules/edge/domain/placement src/modules/edge/application/placement src/modules/edge/presentation/dto/placement.dto.spec.ts src/modules/edge/presentation/controllers/placement.controller.auth.spec.ts
```

| Exit | Résumé |
|------|--------|
| **0** | **5** files / **65** tests passed |

## 2. PostgreSQL transactional / concurrency

```bash
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-placement-transactional.spec.ts
```

| Exit | Résumé |
|------|--------|
| **0** | **1** file / **8** tests passed |

Couverture : happy path place+reserve ; rollback audit/outbox/history ; anti-overbook concurrent ; idempotence ; expire ; release.

## 3. API authz

Inclus dans les 65 tests unitaires (`placement.controller.auth.spec.ts`).

## 4. Frontend

```bash
npm test -- --run lib/edge/placement components/edge/placement "app/(edge-console)/edge/provisioning/capacity"
```

| Exit | Résumé |
|------|--------|
| **0** | **3** files / **23** tests passed |

## 5. Typecheck backend

```bash
npm run typecheck
```

| Exit | Note |
|------|------|
| **0** (après fix `authorizationRowId` null-guard) | |

## 6. Typecheck frontend

| Exit | Note |
|------|------|
| **1** global | Dettes préexistantes sales/subscriptions ; **0** erreur filtrée sur `placement` / `provisioning/capacity` attendu |

## 7. Lint scoped

Registry/placement scoped oxlint — exécuté selon disponibilité ; lint global toujours bloqué par UTF-8 préexistant `sales.entity.ts`.

## 8. Migration éphémère

```bash
docker run … -p 55434:5432 postgres:16-alpine
CONTROL_PLANE_DB_PORT=55434 npm run migrate:control
```

| Exit | Preuve |
|------|--------|
| **0** | `Applied 098_edge_p7_placement_capacity_management` |
| SQL | 7 tables `edge_p7_placement_*` / `edge_p7_capacity_*` ; 11 permissions |

## 9. Smoke API HTTP live

| Mode | Statut |
|------|--------|
| Authz Nest | **PASS** |
| HTTP Bearer live | **NOT RUN** (API locale absente) |

## 10. Non-régression P7.1 / P7.2

| Suite | Exit | Résumé |
|-------|------|--------|
| `test:edge:provisioning` | **0** | 11 files / 55 passed |
| `test:edge:registry` | **0** | 4 files / 74 passed |
