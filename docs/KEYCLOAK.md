# Keycloak Integration

## Architecture

Keycloak is the identity and authorization authority. The platform validates JWTs but does not manage user credentials directly.

```
User → Keycloak (login) → JWT → Platform Core (validation) → TenantContext
```

## Required JWT Claims

| Claim | Purpose |
|-------|---------|
| `sub` | Subject ID |
| `tenant_id` | Tenant resolution (required) |
| `organization_id` | Active organization (optional) |
| `organization` | List of organization IDs |
| `realm_access.roles` | Realm roles |
| `resource_access.<client>.roles` | Client roles |
| `permissions` | Fine-grained permissions |
| `azp` | Client ID |
| `preferred_username` | Display username (not identity key) |

## Configuration

Local Keycloak (default host port **8181**):

```env
KEYCLOAK_URL=http://localhost:8181
KEYCLOAK_ISSUER=http://localhost:8181/realms/platform
KEYCLOAK_JWKS_URI=http://localhost:8181/realms/platform/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=platform-api
KEYCLOAK_CLIENT_ID=platform-api
KEYCLOAK_CLIENT_SECRET=platform-api-secret
KEYCLOAK_ADMIN_ENABLED=true
KEYCLOAK_ADMIN_URL=http://localhost:8181
KEYCLOAK_ADMIN_REALM=platform
KEYCLOAK_ADMIN_CLIENT_ID=platform-admin
KEYCLOAK_ADMIN_CLIENT_SECRET=platform-admin-secret
```

Edge frontend (`edge-frontend/.env`):

```env
NEXT_PUBLIC_AUTH_MODE=bff
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8181
NEXT_PUBLIC_KEYCLOAK_REALM=platform
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=platform-web
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Clients

| Client | Type | Purpose |
|--------|------|---------|
| `platform-web` | Public + PKCE | Edge frontend BFF (`:3001`) — ROPC off; audience `platform-api` |
| `platform-api` | Confidential | Backend resource / password grant / service account |
| `platform-admin` | Confidential + SA | Admin API (orgs, users, sessions) |
| `platform-b2c` | Public + PKCE | Customer portal — ROPC disabled |

Redirect URIs for `platform-web` include `http://localhost:3001/api/auth/callback` and `silent-check-sso.html`.

## Organizations

Keycloak Organizations feature maps to platform organizations:
- One Keycloak organization = one platform organization (branch/establishment)
- Organizations belong to exactly one tenant
- Users can belong to multiple organizations within the same tenant
- `pnpm keycloak:import` creates real KC orgs for `org-a1` / `org-a2` / `org-b1`, attaches seed users, enables the **Organization Membership** mapper (`addOrganizationId`), and writes live ids into `organizations.keycloak_organization_id`
- Active org for seed users defaults to `org-a1` via user attribute `organization_id` (= KC org id); JWT may also carry the KC 26 `organization` object claim

## Realm Setup (Development)

### Option 1: Docker auto-import

```bash
docker compose up -d keycloak
```

Realm file: `docker/keycloak/platform-realm.json` (mounted via `--import-realm`).  
Compose publishes Keycloak on **8080** inside Docker; many local setups remap to **8181** on the host — match `KEYCLOAK_*` to the host URL you actually open.

### Option 2: Admin API import / sync

```bash
pnpm keycloak:import
```

Creates the realm if missing, then **upserts** clients (redirects, PKCE, audience/`tenant_id` mappers), roles, seed users, and `platform-admin` service-account roles.

### Test User

| Field | Value |
|-------|-------|
| Username | `user-a` |
| Password | `password` |
| tenant_id | `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` |
| organization_id (attr) | Keycloak org id for `org-a1` after `keycloak:import` (legacy seed used app UUID) |
| App org UUID | `11111111-1111-4111-8111-111111111111` (`org-a1`) |

Also seeded: `admin-a` / `password` (roles `tenant-admin`, `user`).

Realm password policy (import): `length(8) and notUsername` — tighten outside local.

## Realm Setup (Manual)

1. Start Keycloak (e.g. http://localhost:8181 — admin/admin)
2. Ensure realm `platform` exists (or run `pnpm keycloak:import`)
3. Client `platform-web`: public, standard flow, PKCE S256, redirects to `http://localhost:3001/*`
4. Audience mapper on `platform-web` → include `platform-api` (required by Nest JWT validation)
5. User attribute mappers: `tenant_id`, `organization_id`
6. Enable Organizations feature when available

## Token Validation

Implemented in `JwtValidationService`:
- Remote JWKS fetch and cache
- Signature verification via `jose`
- Issuer and audience validation
- Expiration check
- Claims extraction into `AuthenticatedUser`

## Security Rules

- Never trust claims without signature validation
- `tenant_id` from JWT only — not from headers
- Organization membership verified against control plane DB
- Token refresh handled by client/Keycloak, not platform
