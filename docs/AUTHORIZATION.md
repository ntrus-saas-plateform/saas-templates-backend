# Authorization

Platform Core implements defense-in-depth authorization: JWT authentication, tenant isolation, organization scope, and permission-based access control (RBAC).

## Request pipeline

```
Bearer JWT
  → AuthGuard (JWT validation, tenant context)
  → TenantGuard (tenant exists, matches JWT)
  → TenantWritableGuard (tenant not suspended/archived for writes)
  → OrganizationGuard (org membership when required)
  → PermissionGuard (@RequirePermissions / @RequireRoles)
  → StepUpGuard (@RequireStepUp for sensitive ops)
  → Controller
```

## Permission model

Permissions are strings like `organizations:read`, `tenant:update`, `users:invite`.

Sources (merged by `AuthorizationService`):

1. Organization membership `permissions` array (active membership for current org context)
2. Role catalog permissions for membership `roles` (DB-backed)
3. Active delegations where current user is grantee (org-scoped)
4. Active emergency access grants where current user is operator (`scope.permissions`)
5. JWT `permissions` claim — only accepted when the permission exists in the catalog **and** is already derivable from sources 1–4 (forged claims are ignored)

Catalog is seeded in `migrations/control-plane/008_rbac_catalog.sql` + `010_rbac_seed.sql`.

### Decorators

```typescript
@RequirePermissions('organizations:read')
@RequireRoles('tenant_admin')
@RequireStepUp('1')  // MFA / elevated auth (acr claim)
```

`@Public()` bypasses authentication for health/metrics endpoints.

## Tenant isolation

- `tenant_id` is extracted from JWT only.
- Cross-tenant access returns generic **403** (anti-enumeration).
- Repository queries always filter by `tenant_id` from `TenantContextService`.

## Organization scope

- **Source of truth:** Keycloak JWT organization claims (post-login picker or token refresh).
- `ActiveOrganizationResolver` maps Keycloak org id or alias to application `organizations.id` and validates membership in the control-plane DB.
- Legacy tokens may carry application UUIDs directly in `organization_id`.
- In-app switch updates Keycloak and requires client token refresh (`requiresTokenRefresh: true` on switch response).
- Organization-scoped resources return 403 when org is not accessible.
- **ABAC (org data access):** `organization-access.policy.ts` enforces that listing or reading organization-scoped membership data requires an active membership in that org **or** a tenant-admin role on any membership. Implemented in `OrganizationAccessPolicyService` (identity module) and mirrored in `PolicyEvaluatorService` (shared) for cross-module use.

## External policy engine (OPA)

Optional Open Policy Agent integration for resource-level evaluation beyond route-level `@RequirePermissions`.

| Env | Default | Purpose |
|-----|---------|---------|
| `OPA_ENABLED` | `false` | Use OPA HTTP adapter instead of in-process evaluator |
| `OPA_URL` | `http://localhost:8181` | OPA server base URL |
| `OPA_POLICY_PATH` | `platform/authz/allow` | Data API path (`POST /v1/data/{path}`) |
| `OPA_TIMEOUT_MS` | `3000` | Request timeout; falls back to in-process on error |

Inject `POLICY_EVALUATOR_PORT` and call `evaluate({ tenantId, subjectId, organizationId, action, resource, permissions })` → `AuthorizationDecision`.

- **In-process default:** `InProcessPolicyEvaluator` — RBAC + org ABAC (same rules as guards).
- **OPA adapter:** `OpaPolicyEvaluator` posts OPA-compatible input; sample Rego in `policies/platform-authz.rego`.

Deploy OPA: `opa run --server policies/`

## Platform admin

Users with realm role `platform-admin` receive catalog permissions `tenants:create`, `tenants:admin`, and related admin capabilities via `AuthorizationService.addPlatformAdminRolePermissions`.

Admin APIs (require `platform-admin` realm role):

- `POST /api/v1/admin/tenants` — provision tenant database + control-plane row
- `POST /api/v1/admin/tenants/:tenantId/status` — transition tenant status (cross-tenant, triggers KC lifecycle on suspend/activate)

## Role management

Tenant-scoped role CRUD:

- `POST /api/v1/roles` — create custom role (tenant/org scope only; not `platform`)
- `PATCH /api/v1/roles/:roleId` — update description/permissions (system roles protected)
- `DELETE /api/v1/roles/:roleId` — delete custom role (system roles protected)

## Last-admin protection

Revoking the last tenant administrator membership is denied until ownership is transferred. The check runs inside a control-plane transaction to avoid races under concurrent revoke attempts.

## Feature flags

Resolved via `ConfigurationResolverService` namespace `features.*`:

| Flag | Default | Purpose |
|------|---------|---------|
| `invitations` | `true` | Invitation flows |
| `keycloakSync` | `true` | KC Admin sync on mutations |

`GET /api/v1/feature-flags` lists resolved flags for current context (paginated `{ data, pagination }`).

Each item: `{ key, enabled, namespace, defaultValue, overrideable }`.

## Configuration & policies

Tenant security policies (`security.*` namespace):

- `mfaPolicy`: `optional`, `required`, `required_for_admins`, `required_for_sensitive_ops`
- `sessionLifetimeMinutes`, `idleTimeoutMinutes`

Settings validation uses `src/modules/identity/domain/configuration/setting-definition.ts` (Zod schemas). Sensitive settings require `secret://` references and are masked in API responses.

## Audit

Mutations with `@AuditAction(action, resource)` emit audit records and outbox events where applicable.

## API reference

See [API-REFERENCE.md](../API-REFERENCE.md) for endpoint-level permission requirements.

## Testing

- `npm run test:security` — cross-tenant, enumeration, guard behavior
- Permission guard specs in `src/shared/auth/permission.guard.spec.ts`
