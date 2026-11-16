# P7.8 — Test Evidence

## Backend

| Suite | Focus |
|-------|-------|
| `configuration-schema.engine.spec.ts` | Checksum, validation, plaintext secret rejection |
| `configuration.controller.auth.spec.ts` | Permission decorator matrix |
| Domain / use-case unit tests (as present in tree) | Assign expansion reject, workflow launch, rollback guards |

### Suggested commands

```powershell
cd saas-templates-backend
npx tsc --noEmit
npx vitest run src/modules/edge/domain/configuration-entitlement
npx vitest run src/modules/edge/presentation/controllers/configuration.controller.auth.spec.ts
# Optional full suite (may be long):
# npm test
```

## Frontend

| Suite | Focus |
|-------|-------|
| `edge-configuration-module.test.tsx` | Forbidden without read; schemas list; deploy button gated; secret redaction |

### Command

```powershell
cd saas-template-frontend
npx vitest run components/edge/configuration
```

## Migration

- File: `migrations/control-plane/103_edge_p7_configuration_entitlement_deployment.sql`
- Seeds configuration + entitlement permissions and tables.

## Prior phases

Integration audit (P7.1–P7.7 preflight):  
`docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md`
