# P7.2 — Preuves de tests

## Suites exécutées (réel)

### Backend registry (domain + application + security redaction)

```bash
npm run test:edge:registry
```

| Champ | Valeur |
|-------|--------|
| Date | 2026-11-10 |
| Exit code | 0 |
| Résumé | Test Files **4** passed / Tests **20** passed |

Couverture :
- lifecycle transitions / provisionable
- compatibility engine deterministic
- use-cases: register P1 FK, audit fail-closed, certify→provisionable, release channel normalize, retired contract INCOMPATIBLE
- secret redaction source contract

### Backend typecheck

```bash
npm run typecheck
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |

### Migration runtime (éphémère Postgres Docker `p72-pg` :55432)

```bash
CONTROL_PLANE_DB_HOST=127.0.0.1
CONTROL_PLANE_DB_PORT=55432
CONTROL_PLANE_DB_NAME=platform_control
CONTROL_PLANE_DB_USER=postgres
CONTROL_PLANE_DB_PASSWORD=postgres
npm run migrate:control
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |
| Preuve | `Applied 096_edge_p7_product_platform_runtime_registry` + `Control plane migrations complete` |

Vérifications SQL post-migrate :

```text
schema_migrations: 096_edge_p7_product_platform_runtime_registry
tables edge_p7_product_registry, edge_p7_product_technical_versions,
  edge_p7_product_platforms, edge_p7_runtime_environments,
  edge_p7_deployment_profiles, edge_p7_product_control_contracts,
  edge_p7_compatibility_evaluations, edge_p7_registry_history
permissions product_registry/platforms/runtime/profiles/contracts/registry_*
deployment profiles: SHARED_SAAS, DEDICATED_DATA, DEDICATED_RUNTIME, PRIVATE_CLOUD, ON_PREMISE
```

### Frontend

```bash
npm test -- --run lib/edge/registry.test.ts
```

| Champ | Valeur |
|-------|--------|
| Exit code | 0 |
| Résumé | 4 passed |

### Non-régression P7.1

```bash
npm run test:edge:provisioning
```

| Champ | Valeur |
|-------|--------|
| Dernier run connu | 11 files / 55 passed |
