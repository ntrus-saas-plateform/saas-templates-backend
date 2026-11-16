# P10 — Testing strategy

## Présent (code)

| Suite | Fichier | Nature |
|-------|---------|--------|
| Policy | `acquisition-policy.spec.ts` | Domain transitions / SoD / price / no-card |
| Conditions | `form-condition.spec.ts` | AND/OR/EQ/NEQ/IN/EXISTS |
| Validation | `form-validation.spec.ts` | Schema answers |
| Use-cases | `acquisition.use-cases.spec.ts` | Application layer mocks |
| Auth matrix | `acquisition.controller.auth.spec.ts` | Permissions routes |
| **§27.6 scenarios** | `acquisition-scenarios.spec.ts` | **domain/application scenario suite** (40) |

**domain/unit tests present** + suite scénarios.  
Ne pas interpréter comme live browser E2E.

## Cible E2E (mandat)

**40 scénarios** couvrant discovery → form → application → docs → qualification → quote → checkout → handoff → portal / public.

## Statut honnête

### Domain/application (exécuté)

```bash
pnpm exec vitest run src/modules/edge/application/acquisition/acquisition-scenarios.spec.ts
```

**40/40 Pass** — evidence : [`e2e-scenario-evidence.md`](./e2e-scenario-evidence.md)

### Live browser E2E

> **full live browser E2E 40 scenarios pending**

Pas de rapport Playwright/Cypress P10 attaché. Ne pas revendiquer browser E2E pour la suite Vitest.

## Recommandé avant ACCEPTED

1. Appliquer mig 117 sur DB de test
2. Auth matrix smoke authentifié
3. Parcours public throttle
4. Matrice 40 scénarios avec artefacts (traces / screenshots / JUnit)
5. Chaos : outbox fail, idempotency replay, handoff sans evidence

## Testcontainers

E3 dédié mig 117 : **pending** (comme P9 mig 116).
