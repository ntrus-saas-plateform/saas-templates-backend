# P7.10 — Test Evidence

## Backend suites

| Suite | Focus | Result (2026-11-16) |
|-------|-------|---------------------|
| `activation-policy.spec.ts` | Aggregate readiness / fail-closed rules | Included |
| `activation.controller.auth.spec.ts` | Permission decorator matrix | Included |
| Domain + auth combined | readiness-activation + auth spec | **15 / 15 passed** |
| Full unit suite | `npm test` | **919 / 919 passed** (155 files) |
| Security suite | `npm run test:security` | **89 / 89 passed** (12 files) |
| Typecheck | `npx tsc --noEmit` | **0 errors** |

### Commands executed

```powershell
cd saas-templates-backend
npx tsc --noEmit
npx vitest run src/modules/edge/domain/readiness-activation src/modules/edge/presentation/controllers/activation.controller.auth.spec.ts
npm test
npm run test:security
```

## Frontend

| Suite | Result |
|-------|--------|
| `components/edge/activation` | **3 / 3 passed** |

```powershell
cd saas-template-frontend
npx vitest run components/edge/activation
```

## Migration

- File: `migrations/control-plane/105_edge_p7_readiness_activation.sql`
- Seeds `platform:activation:*`, role binds, `edge_p7_*` readiness/activation tables, `schema_migrations` version `105_edge_p7_readiness_activation`.
