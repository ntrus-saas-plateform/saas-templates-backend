# P7.4 — Preuves de tests

**Date :** 2026-11-10  
**Branche :** `feature/console`

## Domain / application

```bash
npx vitest run src/modules/edge/domain/workflow src/modules/edge/application/workflow …
```

| Exit | Résumé |
|------|--------|
| **0** | **68** unit tests (domain+application+dto+auth) passed earlier; re-run domain/application after lifecycle fix |

## Worker concurrency + TX PostgreSQL

```bash
$env:TESTCONTAINERS='true'
npx vitest run --config ./vitest.config.integration.ts test/integration/edge-workflow-transactional.spec.ts
```

| Exit | Résumé |
|------|--------|
| **0** | **6/6** — atomic create; rollback audit/outbox/history; dual claim (1 win); stale fencing rejected; compensation reverse order; human approval atomic |

## Frontend

| Exit | Résumé |
|------|--------|
| **0** | **22** UI tests Workflow Operations |

## Typecheck backend

| Exit | **0** (après fix IntegrationEvent enqueue + placement COMMITTED + auth revalidate) |

## Migration 099

| Exit | **0** — Applied on `p74-pg:55435` ; 11 workflow tables ; 15 permissions |

## Smoke HTTP live

| **NOT RUN** | API locale absente |

## Régression

| Suite | Exit | Résumé |
|-------|------|--------|
| P7.1 provisioning | **0** | 55 passed |
| P7.2 registry | **0** | 74 passed |
| P7.3 placement | **0** | 38 passed |
