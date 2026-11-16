# P7.9 — Test Evidence

## Backend suites

| Suite | Focus | Result (2026-11-16) |
|-------|-------|---------------------|
| `experience-access.policy.spec.ts` | Redirect/origin/hostname, ownership, domain bind | Included in domain pack |
| `experience.controller.auth.spec.ts` | Permission decorator matrix | Included in auth pack |
| Domain + auth combined | `product-experience` + auth spec | **22 / 22 passed** |
| Full unit suite | `npm test` | **904 / 904 passed** (153 files) |
| Security suite | `npm run test:security` | **89 / 89 passed** (12 files) |
| Typecheck | `npx tsc --noEmit` | **0 errors** |

### Commands executed

```powershell
cd saas-templates-backend
npx tsc --noEmit
npx vitest run src/modules/edge/domain/product-experience src/modules/edge/presentation/controllers/experience.controller.auth.spec.ts
npm test
npm run test:security
```

## Frontend

| Suite | Result |
|-------|--------|
| `components/edge/experience` | **3 / 3 passed** |

```powershell
cd saas-template-frontend
npx vitest run components/edge/experience
```

## Migration

- File: `migrations/control-plane/104_edge_p7_product_experience_provisioning.sql`
- Seeds `platform:experience:*` permissions, role binds (SUPER_ADMIN / OPERATOR), `edge_p7_experience_*` tables, and `schema_migrations` version `104_edge_p7_product_experience_provisioning`.

## Prior phases

`docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md`
