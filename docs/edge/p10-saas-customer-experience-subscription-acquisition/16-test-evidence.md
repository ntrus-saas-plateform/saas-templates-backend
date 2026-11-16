# 16 — Test evidence (remediation)

**Date :** 2026-11-16 · Branche `feature/console`

## Backend

| Suite | Résultat | Preuve |
|-------|----------|--------|
| `acquisition-scenarios.spec.ts` | **40/40 Pass** (41 tests + ledger) | [`e2e-scenario-evidence.md`](./e2e-scenario-evidence.md) |
| Vitest acquisition aggregate | **133+** passed (post storage/challenge/consent) | Session remédiation |
| `marketing-consent.spec.ts` | Adversarial P0 (mandatory / mismatch / NOT_PROVIDED) | Nouveau |
| `acquisition-rate-limiter.spec.ts` | Redis + local fallback | Nouveau |
| Handoff / storage / challenge specs | Pass | Infra acquisition |

Commande scénarios :

```bash
pnpm exec vitest run src/modules/edge/application/acquisition/acquisition-scenarios.spec.ts
```

## Frontend

| Suite | Résultat | Preuve |
|-------|----------|--------|
| Module acquisition Vitest | **14** passed | Session |
| Playwright smoke + scenarios | **18/18** exit 0 | [`playwright-live-evidence.md`](./playwright-live-evidence.md) |

```bash
pnpm exec playwright test e2e/edge-acquisition-smoke.spec.ts e2e/edge-acquisition-scenarios.spec.ts --reporter=line
```

Note : run evidence avec webServer FE ; **backend Edge down** accepté pour shells/proxy (4xx/5xx upstream).

## Migrations

| Evidence | Résultat |
|----------|----------|
| [`migration-apply-evidence.md`](./migration-apply-evidence.md) | **117 + 119** applied (118 inclus) sur PG 16 Docker |
| Mig **120** | Fichier SQL présent ; apply evidence multi-env **pending** |
| Mig **121** | Absent |

## Non evidenced (honnête)

- Testcontainers concurrency suite complète  
- Live Edge + ClamAV + S3 prod smoke  
- Playwright happy-path 40 métier authentifié  
- Push remote succès garanti
