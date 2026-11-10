# P7.5 — Preuves de tests

**Date :** 2026-11-10  
**Branche :** `feature/console`

## Unit / domain / security / DTO / auth

| Suite | Exit | Résumé |
|-------|------|--------|
| product-control domain+app+dto+auth | **0** | **63** passed (9 files) |

## PostgreSQL transactional

```bash
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-product-control-transactional.spec.ts
```

| Exit | Résumé |
|------|--------|
| **0** | **6/6** — register atomic; rollback audit/outbox; idempotent handshake; quarantine blocks; callback dedup |

## Frontend

| Exit | Résumé |
|------|--------|
| **0** | **14** passed |

## Typecheck backend

| Exit | **0** |

## Migration 100

| Exit | **0** — Applied on `p75-pg:55436` ; 11 tables ; 13 permissions |

## Smoke HTTP live

| **NOT RUN** |

## Régression

| Suite | Exit | Tests |
|-------|------|-------|
| P7.1 provisioning | **0** | 55 |
| P7.2 registry | **0** | 74 |
| P7.3+P7.4 placement+workflow | **0** | 75 |
