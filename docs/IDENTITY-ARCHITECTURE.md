# Identity Architecture

Platform Core identity is a **modular monolith bounded context** under `src/modules/identity/` with hexagonal layout:

```
modules/identity/
├── domain/          # entities, ports, lifecycle rules, events
├── application/     # use cases (no NestJS / shared imports)
├── infrastructure/  # Nest providers, reconciliation job
└── presentation/    # controllers, DTOs, Swagger
```

Cross-cutting auth lives in `src/shared/auth/` (JWT, guards). Keycloak Admin client in `src/shared/keycloak/`.

## Context resolution flow

```
Keycloak JWT
  → JwtValidationService (tenant_id, organization claims)
  → ActiveOrganizationResolver (KC id/alias → app org UUID + membership)
  → TenantContext (AsyncLocalStorage)
  → Guards (tenant, org, permissions, step-up)
  → Use case
  → Outbox event (mutations)
```

## Related documents

| Doc | Topic |
|-----|-------|
| [TENANT-ARCHITECTURE.md](./TENANT-ARCHITECTURE.md) | Tenant lifecycle, provisioning |
| [ORGANIZATION-ARCHITECTURE.md](./ORGANIZATION-ARCHITECTURE.md) | Organizations, KC sync, switch |
| [KEYCLOAK-INTEGRATION.md](./KEYCLOAK-INTEGRATION.md) | JWT claims, Admin API |
| [AUTHORIZATION.md](./AUTHORIZATION.md) | RBAC, guards |
| [MEMBERSHIPS.md](./MEMBERSHIPS.md) | Grant/revoke |
| [INVITATIONS.md](./INVITATIONS.md) | Onboarding tokens |
| [CONFIGURATION.md](./CONFIGURATION.md) | Settings resolver |
| [SECURITY-POLICIES.md](./SECURITY-POLICIES.md) | MFA, sessions |
| [AUDIT.md](./AUDIT.md) | Events catalog |

## Data placement

| Data | Store |
|------|-------|
| tenants, organizations, memberships, roles, invitations | Control plane PostgreSQL |
| user_preferences, tenant/org settings, outbox | Tenant PostgreSQL |
| Credentials, sessions, MFA | Keycloak only |

## Platform module

Session context and org switch orchestration: `src/modules/platform/` (`SwitchOrganizationUseCase`, context API).
