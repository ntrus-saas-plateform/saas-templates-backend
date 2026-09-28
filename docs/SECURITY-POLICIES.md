# Security Policies

Tenant-scoped policies live in `tenant_settings` namespace `security.*`, resolved by `ConfigurationResolverService`.

## MFA policy (`security.mfaPolicy`)

| Value | Behavior |
|-------|----------|
| `optional` | MFA not enforced by platform |
| `required` | All users must enroll MFA (Keycloak) |
| `required_for_admins` | Tenant admins only |
| `required_for_sensitive_ops` | Step-up on `@RequireStepUp()` endpoints |

Status: `GET /api/v1/security/mfa/status` (Keycloak credentials query).

## Session policies

- `security.sessionLifetimeMinutes`
- `security.idleTimeoutMinutes`

Enforced in Keycloak realm/client settings; platform stores policy intent in tenant settings.

## Sessions API

| Method | Path | Backend |
|--------|------|---------|
| GET | `/api/v1/sessions` | Keycloak list sessions |
| POST | `/api/v1/sessions/revoke` | Revoke one session |
| POST | `/api/v1/sessions/revoke-all` | Logout all devices |

## Step-up

`@RequireStepUp('1')` checks JWT `acr` / `amr`. Used for ownership transfer and sensitive admin operations.

## Break-glass / delegation

Implemented (migration `011_delegation_emergency`):

| Table | Purpose |
|-------|---------|
| `delegations` | Temporary permission grant from grantor → grantee (org-scoped, expiry) |
| `emergency_access_grants` | Break-glass access with reason, approver, operator, max 24h |

| Method | Path | Permission | Step-up |
|--------|------|------------|---------|
| GET | `/api/v1/delegations` | `delegation:read` | — |
| POST | `/api/v1/delegations` | `delegation:grant` | — |
| POST | `/api/v1/delegations/:id/revoke` | `delegation:grant` | — |
| GET | `/api/v1/emergency-access` | `emergency_access:read` | — |
| POST | `/api/v1/emergency-access` | `emergency_access:grant` | `@RequireStepUp('1')` |
| POST | `/api/v1/emergency-access/:id/revoke` | `emergency_access:grant` | — |

Grantor can only revoke their own delegations. Emergency grants require approver ≠ operator and reason ≥ 10 chars.
