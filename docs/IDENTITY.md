# Identity

**Identity ≠ User.** Identity is authentication (Keycloak). User is the business profile (platform). Membership binds a user to tenant/org with roles.

```
IDENTITY (Keycloak)          USER (platform)           MEMBERSHIP (platform)
├── Keycloak ID (sub)        ├── User ID               ├── Tenant
├── Authentication           ├── Status                ├── Organization
├── Credentials              ├── Profile               ├── Roles
├── MFA                      ├── Preferences           ├── Permissions
├── Sessions                 └── Personalization       └── Scopes
└── Identity Providers
```

Keycloak is source of truth for: authentication, credentials, sessions, MFA, IdPs, federation, Keycloak Organizations, auth flows.

The ERP owns: user profile, preferences, business organization configuration, authorization mirrors.

## Mapping (§46–50)

| Concern | Owner | Platform surface |
|---------|-------|------------------|
| Password / reset / passkeys / OTP / recovery | Keycloak | Account Console + `kc_action` URLs via `GET /users/me/identity` |
| MFA TOTP / WebAuthn / enforcement | Keycloak + tenant `security.mfaPolicy` | Self identity + `GET/PATCH /security/policies` |
| Login / logout / refresh / session | Keycloak + BFF | Sessions API + edge BFF |
| Account lock / failed attempts | Keycloak brute-force | Observed via login history + KC admin |
| Suspicious login | Platform | Login history + inbox “New sign-in” |
| Identity Providers (local, Google, Microsoft, Apple, GitHub, SAML, OIDC, LDAP/AD) | Keycloak realm IdPs | Shell `/settings/identity-providers` + `GET/POST/PATCH/DELETE /security/identity-providers` |
| Link / unlink / primary / provider user id | Keycloak federated identities | Links embedded in `GET /users/me/identity`; unlink via `DELETE /users/me/identity/links/:provider` |
| Email / MFA / device verification | Keycloak + soft devices | `POST .../verify-email`, MFA enroll, devices |
| Phone KYC (OTP WhatsApp) | Platform (Meta WhatsApp Cloud API or dry-run) | `POST /users/me/identity/phone/send-otp` + `verify-otp` → sets `verification.phoneVerified` |
| Keycloak Organization | Keycloak | Synced → app Organization + Membership (`keycloak_organization_id`) |

```
Keycloak Organization
        ↓
Identity / Membership (sync)
        ↓
Application Organization (ERP)
        ↓
Business Configuration (tenant/org settings)
```

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/v1/users/me/identity` | Credentials, MFA, links, verification, enroll URLs |
| DELETE | `/api/v1/users/me/identity/links/:provider` | Unlink federated IdP |
| POST | `/api/v1/users/me/identity/verify-email` | Trigger Keycloak `VERIFY_EMAIL` |
| POST | `/api/v1/users/me/identity/reset-password` | Trigger Keycloak `UPDATE_PASSWORD` |
| POST | `/api/v1/users/me/identity/phone/send-otp` | Send phone KYC OTP (WhatsApp / dry-run) |
| POST | `/api/v1/users/me/identity/phone/verify-otp` | Verify OTP → `verification.phoneVerified` |
| GET | `/api/v1/users/me/security` | Legacy alias of identity overview (compat) |
| GET | `/api/v1/security/identity-providers` | Realm IdP catalog |
| POST | `/api/v1/security/identity-providers` | Create Keycloak IdP (`security:update`) |
| PATCH | `/api/v1/security/identity-providers/:alias` | Update IdP config / enable |
| DELETE | `/api/v1/security/identity-providers/:alias` | Delete IdP |

See also [USER-ACCOUNT.md](./USER-ACCOUNT.md), [KEYCLOAK-INTEGRATION.md](./KEYCLOAK-INTEGRATION.md), [ORGANIZATION-ARCHITECTURE.md](./ORGANIZATION-ARCHITECTURE.md).

## Settings trees (§52–54)

| Tree | Route prefix | Scope |
|------|--------------|-------|
| Tenant administration | `/settings/*` | Tenant defaults, auth policies, IdPs, Users/Roles links |
| My settings | `/settings/*` (profile, prefs, activity, security…) | Profile, prefs, identity self-service |
| Organization settings | `/settings/organization` → org detail `?tab=` | Org overrides + ops |

## Inheritance (§55)

Business / display resolution (most specific wins):

```
PLATFORM DEFAULT
       ↓
TENANT DEFAULT
       ↓
ORGANIZATION OVERRIDE   (only overrideable keys)
       ↓
USER PREFERENCE
       ↓
SESSION CONTEXT         (ephemeral UI/session overlays)
```

**Do not collapse layers.** Example:

| Layer | Currency |
|-------|----------|
| Tenant default | BIF |
| Organization (transaction) | USD |
| User display preference | EUR |

- Posting a sale → **USD** (org business setting)
- Tenant reports default → **BIF**
- Shell number formatting for that user → **EUR** when reading display prefs

Session context never persists into tenant/org stores; it only overlays resolution for the current request/shell session.

**Shell SESSION (edge-frontend):** `SessionContextProvider` holds ephemeral `sessionOverrides` in `sessionStorage` and nests a merged `PreferencesContext` so `usePreferences()` sees SESSION on top of USER. Preferences → “This browser tab only” writes overrides via `setSessionOverride`. Setters always write the USER base (localStorage); hydrate/save must not clobber session keys when applying API values to that base (see `PreferencesApiHydrator`).

**API SESSION:** `ConfigurationResolverService` accepts `sessionOverrides` on the request context when provided by callers. The prefs GET path is user→org→tenant today (shell-only overlays); request-header session overlays are optional and not required for the shell.

Implemented in `ConfigurationResolverService` (`sessionOverrides` → `userSettings` → org → tenant → platform).
