# API Reference — Platform Core

Base URL (local): `http://localhost:3000`

Swagger UI: `http://localhost:3000/api/docs` (non-production or `SWAGGER_ENABLED=true`)

Frontend cible (Next.js): `edge-frontend` — BFF OIDC + appels API via `/api/backend` et `/api/bootstrap`.

## Authentication

All protected routes require:

```http
Authorization: Bearer <Keycloak JWT>
```

Tenant context is derived from the JWT (`tenant_id` claim). Do not send tenant identifiers in headers for authorization. Active organization is resolved from the JWT organization scope (refresh after switch).

When the request `Host` matches a registered `tenant_domains` hostname, JWT `tenant_id` **must** equal that domain’s tenant or the API returns **403**. Localhost / IP / unmapped hosts use JWT alone.

Optional headers:

| Header | Purpose |
|--------|---------|
| `X-Request-Id` | Client request tracing |
| `X-Correlation-Id` | Distributed tracing |
| `Idempotency-Key` | Safe retries for mutating operations |

## Response envelope

Success:

```json
{ "data": { ... } }
```

Paginated:

```json
{ "data": [ ... ], "pagination": { "page", "limit", "total", "totalPages" } }
```

Error:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied",
    "details": [],
    "requestId": "req-...",
    "correlationId": "corr-..."
  }
}
```

---

## Health & Observability

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/liveness` | Public | Liveness probe |
| GET | `/readiness` | Public | Readiness (DB, Redis, RabbitMQ) |
| GET | `/health` | Public | Service health summary |
| GET | `/metrics` | Public / Bearer token | Prometheus metrics |

---

## Platform (`/api/v1/platform`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/platform/context` | `platform:read` | Current tenant, org, user, roles, permissions |
| GET | `/api/v1/platform/me/capabilities` | Authenticated | Plan, modules, permissions, `capabilityMap`, features, orgs, navigation hints |
| GET | `/api/v1/platform/organizations` | `platform:organizations:read` | Organizations for current user |
| POST | `/api/v1/platform/organizations/switch` | `platform:organizations:read` | Switch active organization (revokes stale tokens) |

**Switch body:** `{ "organizationId": "uuid" }` — refresh JWT after success.

**Capabilities:** backend source of truth. A module disabled by the plan stays off even if the JWT lists a related permission.

---

## Tenants (`/api/v1/tenants`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/tenants/:tenantId` | `tenant:read` | Tenant profile (JWT tenant must match) |
| PATCH | `/api/v1/tenants/:tenantId` | `tenant:update` | Update profile fields |
| POST | `/api/v1/tenants/:tenantId/status` | `tenant:update` | Lifecycle transition |
| POST | `/api/v1/tenants/:tenantId/ownership/transfer` | `tenant:ownership_transfer` | Transfer ownership |

**Status body:** `{ "status": "ACTIVE" | "SUSPENDED" | "ARCHIVED" | ... }`

**Transfer body:** `{ "newOwnerIdentityId": "<Keycloak sub>" }`

---

## Organizations (`/api/v1/organizations`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/organizations` | `organizations:read` | List user's organizations |
| GET | `/api/v1/organizations/:organizationId` | `organizations:read` | Get by ID |
| POST | `/api/v1/organizations` | `organizations:create` | Create (Keycloak sync when configured) |
| PATCH | `/api/v1/organizations/:organizationId` | `organizations:update` | Update |
| POST | `/api/v1/organizations/:organizationId/suspend` | `organizations:suspend` | Suspend |

**Create body:** `{ "name", "slug", "description?", "timezone?", "locale?", "type?" }`  
`type`: `BRANCH|STORE|OFFICE|WAREHOUSE|PHARMACY|RESTAURANT|CLINIC|OTHER` (default `OTHER`). Subject to plan `max_organizations` quota.

---

## Users (`/api/v1/users`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/users` | `users:read` | List users (`?page&limit&status`) |
| GET | `/api/v1/users/me` | `users:read` | Current profile + employment projection |
| PATCH | `/api/v1/users/me` | `users:update` | Update profile (partial merge) |
| GET | `/api/v1/users/me/preferences` | `users:read` | Resolved user preferences |
| PATCH | `/api/v1/users/me/preferences` | `users:update` | Patch preference keys `{ settings: { ... } }` |
| GET | `/api/v1/users/me/personalization` | `users:read` | Favorites, pins, widgets, saved views |
| PATCH | `/api/v1/users/me/personalization` | `users:update` | Patch personalization `{ personalization: { ... } }` |
| GET | `/api/v1/users/me/notifications` | `users:read` | In-app inbox (`?page&limit&unreadOnly`) + `stats.unreadCount` |
| POST | `/api/v1/users/me/notifications` | `users:update` | Create inbox item for current user (seed/self-test) |
| POST | `/api/v1/users/me/notifications/read-all` | `users:update` | Mark all read |
| POST | `/api/v1/users/me/notifications/:id/read` | `users:update` | Mark one read |
| DELETE | `/api/v1/users/me/notifications/:id` | `users:update` | Delete inbox item |
| GET | `/api/v1/users/me/devices` | `users:read` | Soft devices (`?syncSessions=true` syncs from Keycloak) |
| PATCH | `/api/v1/users/me/devices/:id` | `users:update` | Trust/untrust `{ trusted }` |
| DELETE | `/api/v1/users/me/devices/:id` | `users:update` | Remove soft device entry |
| POST | `/api/v1/users/me/devices/enroll-push` | `users:update` | Enroll push (`deviceName`, `pushToken`, `pushPlatform`) |
| DELETE | `/api/v1/users/me/devices/:id/push` | `users:update` | Clear push enrollment |
| GET | `/api/v1/users/me/login-history` | `users:read` | Login history (paginated) |
| POST | `/api/v1/users/me/login-history` | `users:update` | Record login (deduped by JWT jti) |
| GET | `/api/v1/users/me/api-tokens` | `users:read` | List personal API tokens |
| POST | `/api/v1/users/me/api-tokens` | `users:update` | Create token `uat_<tenantId>.<secret>` (plaintext once; optional `scopes`) |
| DELETE | `/api/v1/users/me/api-tokens/:id` | `users:update` | Revoke token |
| GET | `/api/v1/users/me/activity` | `users:read` | Activity feed |
| POST | `/api/v1/users/me/activity` | `users:update` | Append activity event |
| DELETE | `/api/v1/users/me/activity` | `users:update` | Clear activity feed |
| GET | `/api/v1/users/me/identity` | `users:read` | Identity overview (Keycloak SoT): MFA, credentials, links, verification |
| DELETE | `/api/v1/users/me/identity/links/:provider` | `users:update` | Unlink federated IdP |
| POST | `/api/v1/users/me/identity/verify-email` | `users:update` | Send Keycloak VERIFY_EMAIL |
| POST | `/api/v1/users/me/identity/reset-password` | `users:update` | Send Keycloak UPDATE_PASSWORD |
| GET | `/api/v1/users/me/security` | `users:read` | Compat security overview (prefer `/identity`) |
| DELETE | `/api/v1/users/me/security/credentials/:credentialId` | `users:update` | Remove MFA/passkey credential |
| GET | `/api/v1/users/me/memberships` | `users:read` | Current user's org memberships |
| GET | `/api/v1/users/:identityId` | `users:read` | Profile by Keycloak `sub` |
| POST | `/api/v1/users/:identityId/suspend` | `users:suspend` | Suspend user |
| POST | `/api/v1/users/:identityId/disable` | `users:suspend` | Disable user |
| POST | `/api/v1/users/:identityId/reactivate` | `users:update` | Reactivate user |

**Update body:** `{ "profile": { "displayName", "firstName", "lastName", "preferredName", "avatarUrl", "email", "phone", "mobile", "address", "jobTitle", "employeeNumber", ... } }`

See [docs/USER-ACCOUNT.md](docs/USER-ACCOUNT.md).

---

## Memberships (`/api/v1/memberships`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/memberships` | `memberships:read` | List (`?organizationId=&page&limit`) |
| POST | `/api/v1/memberships` | `memberships:create` | Grant membership |
| PATCH | `/api/v1/memberships/:membershipId` | `memberships:update` | Update roles/permissions |
| DELETE | `/api/v1/memberships/:membershipId` | `memberships:revoke` | Revoke (last-admin protected) |

**Grant body:** `{ "userId": "<sub>", "organizationId", "roles?", "permissions?" }`

**Update body:** `{ "roles": [], "permissions": [] }`

---

## Invitations (`/api/v1/invitations`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/invitations` | `users:invite` | List invitations (`?organizationId=&page&limit`) |
| POST | `/api/v1/invitations` | `users:invite` | Create invitation (returns plain token once) |
| POST | `/api/v1/invitations/accept` | `users:read` | Accept with token (email must match JWT) |
| POST | `/api/v1/invitations/:invitationId/revoke` | `users:invite` | Revoke pending invitation |

**Create body:** `{ "organizationId", "email", "roles?", "permissions?", "expiresInHours?" }`

**Accept body:** `{ "token": "..." }`

---

## Roles & Permissions (`/api/v1`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/roles` | `roles:read` | Tenant role catalog |
| POST | `/api/v1/roles` | `roles:create` | Create custom role |
| PATCH | `/api/v1/roles/:roleId` | `roles:update` | Update custom role |
| DELETE | `/api/v1/roles/:roleId` | `roles:update` | Delete custom role |
| GET | `/api/v1/permissions` | `permissions:read` | Permission catalog |

---

## Settings (`/api/v1/settings`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/settings/tenant/:namespace` | `settings:read` | Tenant namespace (merged with defaults) |
| PATCH | `/api/v1/settings/tenant/:namespace` | `settings:update` | Update tenant namespace |
| GET | `/api/v1/settings/organizations/:organizationId/:namespace` | `settings:read` | Org namespace (tenant defaults + overrides) |
| PATCH | `/api/v1/settings/organizations/:organizationId/:namespace` | `settings:update` | Update org overrides |

**Update body:** `{ "values": { "key": "value", ... } }`

Common namespaces: `localization`, `ui`, `security`

`security.mfaPolicy`: `optional` | `required` | `required_for_admins` (enforced at login)

---

## Security (`/api/v1/security`, `/api/v1/sessions`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/security/policies` | `security:read` | Tenant security policies |
| PATCH | `/api/v1/security/policies` | `security:update` | Update policies |
| GET | `/api/v1/security/identity-providers` | `security:read` | Keycloak realm IdP catalog |
| GET | `/api/v1/security/mfa/status` | `security:read` | MFA enrollment status (Keycloak) |
| GET | `/api/v1/sessions` | `users:read` | List current user sessions (Keycloak) |
| POST | `/api/v1/sessions/revoke` | `users:update` | Revoke one session (caller-owned only) |
| POST | `/api/v1/sessions/logout` | `users:update` | Logout current session |
| POST | `/api/v1/sessions/revoke-all` | `users:update` | Revoke all user sessions |

**Policies body:** `{ "mfaPolicy?", "sessionLifetimeMinutes?", "idleTimeoutMinutes?", "extra?" }`

**Revoke body:** `{ "sessionId": "..." }`

---

## Delegations (`/api/v1/delegations`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/delegations` | `delegation:read` | List delegations (`?page&limit`) |
| POST | `/api/v1/delegations` | `delegation:grant` | Grant temporary delegation (step-up) |
| POST | `/api/v1/delegations/:delegationId/revoke` | `delegation:grant` | Revoke delegation |

---

## Emergency access (`/api/v1/emergency-access`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/emergency-access` | `emergency_access:read` | List break-glass grants |
| POST | `/api/v1/emergency-access` | `emergency_access:grant` | Grant emergency access (step-up) |
| POST | `/api/v1/emergency-access/:grantId/revoke` | `emergency_access:grant` | Revoke grant |

---

## Admin — reconciliation (`/api/v1/admin/reconciliation`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/api/v1/admin/reconciliation/run` | `tenant:update` | Run Keycloak ↔ app reconciliation |
| GET | `/api/v1/admin/reconciliation/report` | `tenant:read` | Last reconciliation report |
| GET | `/api/v1/admin/reconciliation/reports` | `tenant:read` | Paginated report history |

**Run body:** `{ "repair": false }` — set `repair: true` to apply safe auto-repairs.

---

## Admin — platform tenants (`/api/v1/admin/tenants`)

Requires realm role `platform-admin` **and** JWT client `platform-admin`.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/v1/admin/tenants` | `platform-admin` | Provision tenant (saga; **requires `Idempotency-Key`**) |
| POST | `/api/v1/admin/tenants/:tenantId/provisioning/retry` | `platform-admin` | Resume `FAILED` / stalled provisioning |
| DELETE | `/api/v1/admin/tenants/:tenantId` | `platform-admin` | Soft deprovision; `?hard=true` drops DB/role |
| GET | `/api/v1/admin/tenants/:tenantId/health` | `platform-admin` | DB, schema, Keycloak orgs, primary domain |
| GET | `/api/v1/admin/tenants/:tenantId/domains` | `platform-admin` | List registered hostnames |
| POST | `/api/v1/admin/tenants/:tenantId/domains` | `platform-admin` | Register hostname (`SUBDOMAIN` → ACTIVE; `CUSTOM` → PENDING verification) |
| POST | `/api/v1/admin/tenants/:tenantId/domains/:domainId/verify/start` | `platform-admin` | Begin DNS TXT verification; returns `txtName` + `token` to set |
| POST | `/api/v1/admin/tenants/:tenantId/domains/:domainId/verify/check` | `platform-admin` | Confirm ownership: body `{ token }` **and** DNS TXT at `_platform-verify.{hostname}` must match; marks domain ACTIVE |
| POST | `/api/v1/admin/tenants/:tenantId/status` | `platform-admin` | Transition tenant status (incl. `LOCKED`, `FAILED`) |

**Provision header:** `Idempotency-Key` (required). Duplicate keys reuse the same tenant row.

**Domain body:** `{ "hostname": "acme.example.com", "type?": "SUBDOMAIN"|"CUSTOM" }`

---

## Feature flags (`/api/v1/feature-flags`)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/feature-flags` | `platform:read` | Resolved flags (`?page&limit`) |

---

## Customers — staff (`/api/v1/customers`)

Staff JWT (`platform-api` / `platform-web`). Tenant scope from JWT `tenant_id` claim.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/customers` | `customers:read` | List tenant customers (`?page&limit&search`) |
| POST | `/api/v1/customers` | `customers:create` | Create customer and link to tenant |
| POST | `/api/v1/customers/guest` | `customers:create` | Create guest (POS / walk-in) |
| POST | `/api/v1/customers/check-duplicates` | `customers:read` | Duplicate check (email, phone, number) |
| POST | `/api/v1/customers/identify` | `customers:read` | Find tenant customer by identifier |
| GET | `/api/v1/customers/:tenantCustomerId` | `customers:read` | Customer aggregate |
| GET | `/api/v1/customers/:tenantCustomerId/360` | `customers:read` | Customer 360 (aggregate + consents + addresses + CRM + timeline) |
| GET | `/api/v1/customers/:tenantCustomerId/export` | `customers:export` | Full data export package |
| POST | `/api/v1/customers/:tenantCustomerId/promote` | `customers:update` | Promote guest → identified |
| POST | `/api/v1/customers/:tenantCustomerId/merge` | `customers:merge` | Merge source duplicate into survivor (`:id` = survivor) |
| POST | `/api/v1/customers/:tenantCustomerId/anonymize` | `customers:delete` | Anonymize PII and archive |
| GET | `/api/v1/customers/:tenantCustomerId/consents` | `customers:read` | Consent history (staff) |
| POST | `/api/v1/customers/:tenantCustomerId/consents/grant` | `customers:manage_consent` | Grant consent on behalf of customer |
| POST | `/api/v1/customers/:tenantCustomerId/consents/withdraw` | `customers:manage_consent` | Withdraw consent |
| GET | `/api/v1/customers/:tenantCustomerId/addresses` | `customers:read` | List addresses (staff) |
| GET | `/api/v1/customers/:tenantCustomerId/interactions` | `customers:crm_read` | CRM interactions (`?page&limit`) |
| POST | `/api/v1/customers/:tenantCustomerId/interactions` | `customers:crm_write` | Create CRM interaction |
| POST | `/api/v1/customers/:tenantCustomerId/organizations` | `customers:update` | Link to organization |

Sensitive fields filtered unless `customers:view_sensitive` or `customers:view_financial`.

---

## Customers — B2C auth (`/api/v1/customer-auth`)

Public endpoints (throttled). Single Keycloak realm; tenant via `tenantSlug` body field.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/customer-auth/register` | Public | Register B2C account |
| POST | `/api/v1/customer-auth/login` | Public | Password login (`platform-b2c` token) |
| POST | `/api/v1/customer-auth/password-reset` | Public | Trigger password reset email |

---

## Customers — B2C portal (`/api/v1/customer`)

JWT from `platform-b2c` client (`@CustomerRoute`). Not accessible with staff tokens.

One **GlobalCustomer** identity across tenants; patient role is **per tenant**. Use `GET /customer/memberships` for the app patient “mes établissements”.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/customer/me` | Current customer profile (JWT tenant context) |
| GET | `/api/v1/customer/memberships` | All tenant links + per-tenant patient role |
| GET | `/api/v1/customer/consents` | Consent history |
| POST | `/api/v1/customer/consents/grant` | Grant consent |
| POST | `/api/v1/customer/consents/withdraw` | Withdraw consent |
| GET | `/api/v1/customer/addresses` | List addresses |
| POST | `/api/v1/customer/addresses` | Add address |
| PATCH | `/api/v1/customer/addresses/:addressId` | Update address |
| DELETE | `/api/v1/customer/addresses/:addressId` | Remove address |

---

## Customer patient role (`/api/v1/customers`)

A **patient is a customer role**, not a separate identity. Source of truth: `tenant_customers` patient fields. `global_customers.is_patient` is derived (any active tenant patient link) for B2C convenience — updated automatically by `PATCH .../patient`.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/customers?isPatient=true` | `customers:read` | List patients for the tenant |
| PATCH | `/api/v1/customers/:tenantCustomerId/patient` | `customers:set_patient` | Mark / unmark patient + care profile |

---

## Permission catalog (summary)

| Area | Permissions |
|------|-------------|
| Platform | `platform:read`, `platform:organizations:read` |
| Tenant | `tenant:read`, `tenant:update`, `tenant:ownership_transfer` |
| Organizations | `organizations:read`, `organizations:create`, `organizations:update`, `organizations:suspend` |
| Users | `users:read`, `users:update`, `users:invite`, `users:suspend` |
| Memberships | `memberships:read`, `memberships:create`, `memberships:update`, `memberships:revoke` |
| RBAC | `roles:read`, `roles:create`, `roles:update`, `permissions:read` |
| Settings | `settings:read`, `settings:update` |
| Security | `security:read`, `security:update` |
| Delegation | `delegation:read`, `delegation:grant` |
| Emergency | `emergency_access:read`, `emergency_access:grant` |
| Customers | `customers:read`, `customers:create`, `customers:update`, `customers:delete`, `customers:export`, `customers:merge`, `customers:view_sensitive`, `customers:manage_consent`, `customers:view_financial`, `customers:crm_read`, `customers:crm_write` |
| Commerce | `commerce:read`, `commerce:create`, `commerce:update`, `commerce:pos_checkout`, `orders:read`, `orders:create`, `orders:cancel`, `loyalty:read`, `loyalty:manage` |
| Customer | `customers:read`, `customers:create`, `customers:update`, `customers:set_patient`, `customers:delete`, … |

Full seed: `migrations/control-plane/010_rbac_seed.sql`, `016_manager_role_seed.sql`, `019_customer_permissions.sql`, `022_commerce_pharmacy_permissions.sql`

---

## Swagger

Generated from NestJS decorators on controllers and DTOs. Enable in production with:

```env
SWAGGER_ENABLED=true
```

Tags align with `src/shared/swagger/swagger.constants.ts`.

---

## External load testing (k6)

Optional k6 script: `test/load/k6/liveness.js` — run against a running instance:

```bash
k6 run test/load/k6/liveness.js
```
