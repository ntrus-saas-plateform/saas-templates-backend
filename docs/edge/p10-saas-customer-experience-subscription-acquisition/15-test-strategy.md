# 15 — Test strategy (remediation)

## Pyramide actuelle

| Couche | Artefacts | Rôle |
|--------|-----------|------|
| Domain unit | `acquisition-policy`, `form-condition`, `form-validation`, `acquisition-public-challenge`, **`marketing-consent`** | Policies / consent P0 |
| Infra unit | `acquisition-rate-limiter`, FS storage, handoff handler | Redis fallback, storage, P5 consumer |
| Application | `acquisition.use-cases.spec.ts` (+ InitiateAcquisitionPayment) | Mocks ports |
| Auth matrix | `acquisition.controller.auth.spec.ts` | Permissions routes |
| **§27.6 scenarios** | `acquisition-scenarios.spec.ts` | **40/40** domain/application in-memory |
| FE unit | module acquisition | ~14 |
| Browser smoke | Playwright smoke + scenarios | **18** live shells / proxy contracts |
| Mig apply | Docker Postgres 16 | 117–119 evidenced |
| Testcontainers concurrency | — | **Incomplete / deferred** |

## Ce que la stratégie revendique / ne revendique pas

- **Oui** : 40 scénarios métier via Vitest fakes ; Playwright contrats UI/proxy ; unit consent + rate-limiter.
- **Non** : full live E2E 40 avec Edge+P5+P6+ClamAV ; suite concurrence Testcontainers complète ; self-ACCEPT prod.

## Avant ACCEPTED enterprise

1. Apply 117/119/120 sur env cibles  
2. Smoke ClamAV CLEAN/INFECTED + S3 réel  
3. Playwright contre API Edge live authentifiée  
4. Compléter harness Testcontainers concurrence  
5. Audit indépendant humain (ce package)
