# P0 Audit — Okapi Edge Platform

**Gate:** P0-A (documentation lock)  
**Date:** 2026-11-09  
**Scope:** Coexistence of Edge Admin Console / Control Plane with existing ERP (Platform Core) without regression.  
**Locked product decisions:** 1A (isolated `edge-console` route group), 2A (dedicated `edge-admin` Keycloak realm).

Evidence grades:

| Grade | Meaning |
|-------|---------|
| **VERIFIED** | Observed in tree with concrete path(s) |
| **PARTIALLY VERIFIED** | Scaffold / partial behavior; not production-complete for Edge |
| **NOT VERIFIED** | Required for Edge; absent today |

---

## 1. Backend (NestJS modular monolith)

### 1.1 Module layout

| Finding | Grade | Evidence |
|---------|-------|----------|
| Modular monolith with `identity` + `platform` bounded contexts | **VERIFIED** | `src/modules/identity/`, `src/modules/platform/`; architecture stated in `docs/IDENTITY-ARCHITECTURE.md` |
| Hexagonal layout (domain / application / infrastructure / presentation) | **VERIFIED** | e.g. `src/modules/identity/identity.module.ts`, controllers under `presentation/`, ports under `domain/ports/` |
| Empty `edge` module directories exist (not wired) | **PARTIALLY VERIFIED** | `src/modules/edge/{application,domain,infrastructure,presentation}/` present; no `EdgeModule` registration found under `src/` |
| Edge HTTP surface `/api/v1/edge/**` | **NOT VERIFIED** | No Edge controllers or route prefix; OpenAPI still ERP-oriented (`docs/openapi.json`, `src/shared/swagger/`) |

### 1.2 JWT / tenancy (ERP contract that must not regress)

| Finding | Grade | Evidence |
|---------|-------|----------|
| JWT validation **requires** `tenant_id` | **VERIFIED** | `src/shared/auth/jwt-validation.service.ts` throws `Invalid token: missing tenant_id claim`; unit coverage in `src/shared/auth/jwt-validation.service.spec.ts`, `test/security/jwt-attacks.spec.ts` |
| Request authority via `TenantContextService` (ALS) | **VERIFIED** | `src/shared/tenancy/tenant-context.service.ts`; `getOrThrow()` requires `tenantId` |
| Platform context + org switch APIs | **VERIFIED** | `GET /platform/context`, `POST /platform/organizations/switch` in `src/modules/platform/presentation/controllers/platform.controller.ts` |
| Authz resolves from memberships / roles / delegation / emergency under tenant context | **VERIFIED** | `src/shared/authorization/authorization.service.ts` |

### 1.3 Keycloak (single ERP realm today)

| Finding | Grade | Evidence |
|---------|-------|----------|
| Single shared realm `platform` for all tenants | **VERIFIED** | `docker/keycloak/platform-realm.json` (`"realm": "platform"`, `organizationsEnabled: true`); `KeycloakRealmResolver` returns `KEYCLOAK_ADMIN_REALM` — `src/shared/keycloak/keycloak-realm.resolver.ts` |
| Clients: `platform-api`, `platform-admin`, `platform-web`, `platform-b2c` | **VERIFIED** | `docker/keycloak/platform-realm.json` clientIds |
| `tenant_id` protocol mapper on platform clients | **VERIFIED** | `src/shared/keycloak/keycloak-realm-tenant-mapper.spec.ts` loads `platform-realm.json` |
| `platform-admin` role + confidential client (must **not** be repurposed for Edge) | **VERIFIED** | Realm roles in `platform-realm.json`; `@RequireRoles('platform-admin')` on `platform-admin.controller.ts`; env default `KEYCLOAK_ADMIN_CLIENT_ID=platform-admin` in `environment.schema.ts` |
| Dedicated `edge-admin` realm / clients | **NOT VERIFIED** | No `edge-admin-realm.json` or Edge issuer config |

### 1.4 Identity lifecycle patterns (reuse as patterns, not shared tables)

| Finding | Grade | Evidence |
|---------|-------|----------|
| Application user statuses (ERP) | **VERIFIED** | `ApplicationUserStatus` in `src/modules/identity/domain/user/application-user.entity.ts` (`INVITED`, `PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, …) — **not** identical to Edge admin states (ADR-004) |
| Hashed single-use invitations | **VERIFIED** | `migrations/control-plane/009_invitations.sql` (`token_hash`); `pg-invitation.repository.ts` |
| Idempotent Keycloak reconcile + drift reports (no silent privilege invent from nowhere) | **VERIFIED** | `ReconcileKeycloakUseCase` in `src/modules/identity/application/reconciliation/`; reports via `reconciliation_reports` / `014_reconciliation_reports.sql` |
| Delegation + temporary emergency (break-glass) | **VERIFIED** | `migrations/control-plane/011_delegation_emergency.sql`; `delegation.controller.ts` |
| Step-up / MFA enforcement hooks | **VERIFIED** | `src/shared/auth/step-up.guard.ts`, `RequireStepUp`, `mfa-enforcement.service.ts` |
| Shared audit writer | **VERIFIED** | `src/shared/audit/pg-audit.writer.ts`, `audit.interceptor.ts`, `@AuditAction` |

### 1.5 Migrations / data placement

| Finding | Grade | Evidence |
|---------|-------|----------|
| Control-plane migrations through **072** | **VERIFIED** | Highest CP file: `migrations/control-plane/072_drop_industry_permissions.sql` (also `071_…`, `067_…`; gaps 064–066 / 068–070 unused) |
| Next Edge schema starts at **073+** on control plane | **NOT VERIFIED** (planned) | No `073_*` Edge migration yet; placement rule in `docs/DATA-PLACEMENT.md` (identity/RBAC on CP) |
| Tenant DB migrations continue past 072 for ERP domains | **VERIFIED** | e.g. `migrations/tenant/076_payment_acquirer_outcome.sql`, `077_drop_industry_profiles.sql` — **out of Edge scope** |
| Edge tables must live in Control Plane only | **NOT VERIFIED** (decision locked in ADR-009) | Consistent with CP placement of invitations/memberships today |

---

## 2. Frontend (`edge-frontend` Next.js app)

| Finding | Grade | Evidence |
|---------|-------|----------|
| Package name `edge-frontend` (ERP shell product) | **VERIFIED** | `saas-template-frontend/package.json` `"name": "edge-frontend"` |
| ERP chrome via `(shell)` route group | **VERIFIED** | `app/(shell)/layout.tsx`, home, identity, settings, admin tenants pages |
| Org Switcher in ERP chrome | **VERIFIED** | `components/shell/org-switcher.tsx`, wired in `shell-top-bar.tsx` / `auth-gate.tsx`; calls platform switch via `usePlatform()` |
| BFF session cookie `edge_bff_session` (iron-session) | **VERIFIED** | `lib/bff/session.ts` (`cookieName: "edge_bff_session"`) |
| Auth BFF routes under `/api/auth/*` + backend proxy `/api/backend/[...path]` | **VERIFIED** | `app/api/auth/{login,callback,logout,session}/route.ts`, `app/api/backend/[...path]/route.ts` |
| PKCE against `platform-web` | **VERIFIED** | `lib/keycloak/pkce-action.ts` defaults `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` → `platform-web` |
| Isolated `(edge-console)` route group | **NOT VERIFIED** | No `app/(edge-console)/` tree |
| Cookies `okapi_edge_*` | **NOT VERIFIED** | Only `edge_bff_session` present for ERP BFF |
| Proxies `/api/edge-auth/*`, `/api/edge-backend/*` | **NOT VERIFIED** | Absent |

---

## 3. Conflicts (must not collide)

| Conflict | Risk | Mitigation (locked) |
|----------|------|---------------------|
| Cookie name confusion (`edge_bff_session` vs future Edge cookies) | Session theft / accidental reuse | New cookies **only** `okapi_edge_*`; never rename ERP cookie (ADR-016, ADR-007) |
| Reusing `platform-admin` client/role for Edge operators | Privilege bleed across ERP + Edge | Dedicated `edge-admin` realm + clients (ADR-002, ADR-003); do **not** repurpose platform-admin |
| Merging `TenantContext` with vertical workspace | Wrong tenant DB / wrong authz | Separate `vertical_workspace_context`; never merge middleware (ADR-001, ADR-004 constraints, ADR-007) |
| Extending ERP JWT validator to accept tokens without `tenant_id` | Breaks ERP invariant or opens Edge tokens into ERP | Edge uses separate issuer/audience + Edge guards; ERP path unchanged (ADR-017) |
| Sharing invitation / membership tables | Domain mix | Edge-specific tables in CP 073+ (ADR-009, ADR-011) |
| Frontend vertical ID treated as authority | IDOR across verticals | Backend membership + session SoT; FE ID is selector only (constraint 5 / ADR-006) |

---

## 4. Gaps (P0 blockers after docs)

1. No `edge-admin` Keycloak realm export / env wiring.  
2. No Edge Control Plane schema (admins, memberships, invitations, sessions, workspace config, audit taxonomy).  
3. No `/api/v1/edge/**` Nest module registration.  
4. No `(edge-console)` UI isolation (chrome, auth, proxies).  
5. No Edge opaque workspace session lifecycle (create/validate/renew/rotate/revoke).  
6. No Edge reconcile job distinct from ERP Keycloak reconcile.  
7. No Redis authz cache contract for Edge (ERP authz is request-time DB resolve today — cache is a planned Edge optimization, ADR-019).

---

## 5. Reuse list (patterns / infra — not business tables)

| Reuse | Source | Edge adaptation |
|-------|--------|-----------------|
| Hexagonal module skeleton | `identity`, `platform` | New `edge` module; empty dirs already stubbed |
| Iron-session BFF pattern | `lib/bff/session.ts` | Separate password/cookie options for `okapi_edge_*` |
| Hashed invitation tokens | `009_invitations.sql` + invitation use cases | Edge invitation tables; same hash/single-use idea |
| Reconcile + drift reports | `ReconcileKeycloakUseCase` | Edge reconcile; **never auto-grant on drift** (ADR-010) |
| Delegation ceiling / emergency TTL | `011_delegation_emergency.sql` | Edge equivalents with stricter never-permanent break-glass (ADR-013, ADR-014) |
| `@AuditAction` + `PgAuditWriter` | `src/shared/audit/` | Extend event taxonomy; do not fork writer blindly (ADR-015) |
| Step-up guard / ACR | `step-up.guard.ts` | Edge MFA policy + step-up (ADR-012) |
| Control-plane migration runner | `migrations/control-plane/` | Continue numbering at **073+** |
| Redis `CacheService` | `src/shared/database/cache.service.ts` | Optional Edge authz cache; never SoT (ADR-019) |
| Outbox / metrics / health | platform health controller | Observability coexistence; separate Edge metrics labels |

**Do not reuse as shared SoT:** ERP `invitations`, `user_organization_memberships`, `application_users`, `TenantContext`, `edge_bff_session`, `platform-web` / `platform-admin` clients.

---

## 6. Compatibility plan (summary)

Full matrix: [`COMPATIBILITY.md`](./COMPATIBILITY.md).

- **Freeze** ERP auth cookies, Keycloak `platform` clients, `/api/v1/**` ERP contracts, Org Switcher, JWT `tenant_id` requirement.  
- **Add** parallel Edge surfaces only (`edge-admin` realm, `/api/v1/edge/**`, `okapi_edge_*`, `(edge-console)`).  
- **Adapt** contracts (audit writer, cache, migration runner) without mixing domains.

---

## 7. Implementation sequence (P0-A … P0-H)

See [`IMPLEMENTATION-SEQUENCE.md`](./IMPLEMENTATION-SEQUENCE.md). Docs gate is **P0-A** (this folder). Code starts only after ADR acceptance.

| Gate | Focus |
|------|--------|
| P0-A | Audit + ADRs + compatibility + sequence (**this deliverable**) |
| P0-B | Keycloak `edge-admin` realm + env isolation |
| P0-C | Control-plane migrations 073+ (Edge schema) |
| P0-D | Nest `edge` module: authn/authz, sessions, invitations, memberships |
| P0-E | Reconcile + cache invalidation + audit taxonomy |
| P0-F | Frontend `(edge-console)` + `okapi_edge_*` + proxies |
| P0-G | Hardening: MFA/step-up, delegation, break-glass, multi-tab |
| P0-H | Regression pack proving ERP unchanged + Edge E2E |

---

## 8. Six mandatory constraints (apply to all Edge work)

1. **No ERP regression** — `tenant_id` JWT, ERP auth, invitations, Org Switcher, `edge_bff_session` / `platform-web` unchanged.  
2. **Strict session separation** — cookies/secrets/validation/renewal/logout/revocation independent.  
3. **Strict Keycloak client separation** — audiences/redirects/scopes must not confuse ERP vs Edge.  
4. **Strict context separation** — `tenant_context` ≠ `vertical_workspace_context`; never merge middleware.  
5. **Backend authority** — frontend vertical ID is selector only.  
6. **Coexistence via adapted contracts** — reuse infra patterns, never mix business domains.

---

## 9. Verdict

Platform Core ERP identity/auth is production-shaped and must remain frozen. Edge Admin is a **greenfield parallel control plane** inside the same Nest monolith and same Next app, isolated by realm, cookies, contexts, tables, and API prefix. P0-A locks those boundaries; implementation must not reopen 1A/2A or the six constraints.
