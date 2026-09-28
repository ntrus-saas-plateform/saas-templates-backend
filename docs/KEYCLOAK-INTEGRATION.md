# Keycloak Integration

Platform Core uses Keycloak for authentication (JWT validation) and optional Admin API operations (organizations, sessions, MFA).

## Components

| Layer | Path | Role |
|-------|------|------|
| JWT validation | `src/shared/auth/jwt-validation.service.ts` | Validates Bearer tokens, parses KC organization claims |
| Active org resolver | `src/shared/auth/active-organization.resolver.ts` | Maps JWT org ref → application UUID + membership check |
| Admin client | `src/shared/keycloak/keycloak-admin.client.ts` | Organizations, sessions, MFA, org switch attribute |
| Token introspection | `src/shared/keycloak/token-introspection.service.ts` | Optional RFC 7662 active-token check |
| User KC lifecycle | `src/modules/identity/application/services/user-keycloak-lifecycle.service.ts` | Per-user disable/enable + session revoke |
| Tenant KC lifecycle | `src/modules/identity/application/services/tenant-keycloak-lifecycle.service.ts` | Bulk disable on tenant suspend |
| Reconciliation | `src/modules/identity/application/reconciliation/` | Drift detection KC ↔ application |
| KC sync | `src/modules/identity/application/services/keycloak-sync.service.ts` | Org create/update, membership grant/revoke |
| Org switch | `src/modules/identity/application/organization/switch-organization.use-case.ts` | In-app switch → KC + token refresh hint |

## Environment

```env
# JWT (required)
KEYCLOAK_ISSUER=http://localhost:8181/realms/platform
KEYCLOAK_JWKS_URI=http://localhost:8181/realms/platform/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=platform-api
KEYCLOAK_CLIENT_ID=platform-api
KEYCLOAK_CLIENT_SECRET=platform-api-secret

# Optional — Redis-backed denylist (revoked subjects / jti)
TOKEN_DENYLIST_ENABLED=true
TOKEN_DENYLIST_TTL_SECONDS=86400

# Optional — online token revocation check (uses admin or client secret)
KEYCLOAK_TOKEN_INTROSPECTION_ENABLED=false

# Admin API (optional — sessions, reconciliation, KC sync)
KEYCLOAK_ADMIN_ENABLED=true
KEYCLOAK_ADMIN_URL=http://localhost:8181
KEYCLOAK_ADMIN_REALM=platform
KEYCLOAK_ADMIN_CLIENT_ID=platform-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=platform-admin-secret

# Scheduled reconciliation (optional)
RECONCILIATION_JOB_ENABLED=true
RECONCILIATION_JOB_INTERVAL_SECONDS=3600
```

## Identity model

- Application identity key is always Keycloak `sub` (never email or username).
- `tenant_id` claim scopes the tenant; never accept tenant from client headers for authorization.
- **Organizations live in Keycloak Organizations**; the application DB mirrors membership for authorization.
- **Active organization comes from the JWT** (Keycloak org picker at login or after token refresh), mapped to application UUID via `keycloak_organization_id` / slug.

## Organization selection flow

```
Login (frontend staff, scope organization)
  → Keycloak org picker (if multiple orgs)
  → JWT contains organization claim (KC 26 object or legacy claims)
  → ActiveOrganizationResolver maps KC id/alias → app organization UUID
  → TenantContext.organizationId set for the request

In-app switch
  → POST /api/v1/platform/organizations/switch
  → Keycloak user attribute updated (setUserActiveOrganization)
  → Client must refresh token with scope organization:<slug>
  → Subsequent requests use new JWT org context
```

Legacy tokens may still use `organization_id` as an application UUID; after `pnpm keycloak:import`, local seed users use the real Keycloak organization id and membership claim.

## Admin API operations

| Operation | Trigger |
|-----------|---------|
| `createOrganization` | `POST /api/v1/organizations` |
| `updateOrganization` | `PATCH /api/v1/organizations/:id` |
| `addUserToOrganization` | Membership grant, invitation accept |
| `removeUserFromOrganization` | Membership revoke |
| `setUserActiveOrganization` | `POST /api/v1/platform/organizations/switch` |
| `listUserSessions` / `revokeSession` | `/api/v1/sessions` |
| `getUserMfaStatus` | `GET /api/v1/security/mfa/status` |

Sync is gated by feature flag `features.keycloakSync` (default: enabled).

## Reconciliation

**Manual:** `POST /api/v1/admin/reconciliation/run` with optional `{ "repair": true }`.

**Scheduled:** Job `keycloak-reconciliation` runs per active tenant when `RECONCILIATION_JOB_ENABLED=true` (Redis distributed lock).

### Drift types

| Type | Severity | Auto-repair |
|------|----------|-------------|
| `organization.keycloak_placeholder` | warning | Creates KC org, updates app record |
| `organization.keycloak_missing` | critical | Report only |
| `membership.keycloak_missing` | warning | Adds user to KC org when `repair=true` |
| `membership.keycloak_extra` | warning | KC member not in app memberships |
| `user.keycloak_missing` | critical | App user identity not found in KC |
| `user.enabled_mismatch` | warning | App status vs KC `enabled` — repair via `setUserEnabled` |
| `user.keycloak_extra` | warning | KC user with no application user record |
| `keycloak.organization_unmapped` | critical | Report only |
| `organization.no_members` | info | Report only |

## Step-up authentication

Sensitive operations (e.g. ownership transfer) require `@RequireStepUp('1')`. The guard checks JWT `acr` claim (LOA2 / numeric ≥ 1).

Configure Keycloak authentication flows to emit appropriate `acr` after MFA.

## Realm setup

Import dev realm: `pnpm keycloak:import`

**Edge frontend (`edge-frontend`)** uses BFF OIDC (`NEXT_PUBLIC_AUTH_MODE=bff`) with public client `platform-web` (PKCE, no ROPC). Flow: `/api/auth/login` → Keycloak → `/api/auth/callback` → HttpOnly iron-session → `/api/bootstrap` → Nest with Bearer. Mutating BFF calls require `X-CSRF-Token` matching the `edge_csrf` cookie.

Configure the staff client with default scope `organization` and Keycloak 26+ scope `basic` (required for `sub` on access tokens). Enable **Organization Membership** mapper with **Add organization id**. Local import also sets user-profile `unmanagedAttributePolicy=ADMIN_EDIT` so `tenant_id` / `organization_id` attributes persist.

Password policy in the imported realm: `length(8) and notUsername` (strengthen for non-local environments). Public client `platform-b2c` has ROPC (`directAccessGrants`) disabled.

Admin client `platform-admin` must have service account roles for realm management when Admin API is enabled.

## Failure behavior

Keycloak Admin calls use a circuit breaker. Sync failures during org/membership mutations are non-blocking (application state remains authoritative; reconciliation reports drift).
