# P7.6 — Preuves de tests

**Date :** 2026-11-10  
**Branche :** `feature/console`

## Domain / auth

| Suite | Exit | Résultat |
|-------|------|----------|
| domain/infrastructure-provisioning + workflow-handler + controller auth | **0** | **27 passed** |

## PostgreSQL IT

```bash
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-infrastructure-provisioning-transactional.spec.ts
```

| Exit | Résultat |
|------|----------|
| **0** | **3/3** — plan atomic; audit rollback; PG provision + isolation + opaque credential_ref |

## Frontend

| Exit | Résultat |
|------|----------|
| **0** | **8 passed** |

## Régression domain P7.1–P7.5 (+ workflow)

| Exit | Résultat |
|------|----------|
| **0** | **192 passed** (20 files) |

## Providers / engines déclarés

- Provider: `local-managed-v1` uniquement
- Engines: PostgreSQL (IT), MongoDB/SurrealDB (adapters présents, admin URL requise)
