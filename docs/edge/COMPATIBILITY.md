# Compatibility Matrix — ERP (frozen) vs Edge (new)

**Purpose:** Explicit list of surfaces that **MUST remain unchanged** versus **new Edge-only** surfaces.  
**Locked:** 1A (`edge-console` route group), 2A (`edge-admin` realm).  
**Related:** [P0-AUDIT.md](./P0-AUDIT.md), ADRs 002–003, 007, 016–017.

Constraints enforced by this matrix: (1) no ERP regression, (2) session separation, (3) Keycloak client separation, (4) context separation, (5) backend authority, (6) adapted contracts only.

---

## 1. Keycloak

| Surface | ERP (unchanged) | Edge (new) |
|---------|-----------------|------------|
| Realm | `platform` (`docker/keycloak/platform-realm.json`) | `edge-admin` (dedicated export; **not** a fork of platform-admin role into ERP) |
| Public web client | `platform-web` (PKCE) | `edge-admin-web` (public PKCE) |
| Confidential / SA API client | `platform-api`, `platform-admin` | `edge-admin-api` (confidential service account) |
| B2C client | `platform-b2c` | N/A (Edge Admin is B2B ops) |
| Organizations meaning | KC Org ↔ ERP business org within tenant | **One KC Organization = one Edge vertical** |
| JWT claim `tenant_id` | **Required** for ERP API tokens | **Not** used as ERP tenant scope; Edge tokens validated by Edge issuer/audience only |
| Redirect URIs / web origins | ERP frontend origins | Edge console paths only (`/edge-console…` or agreed host paths) |
| Audiences / azp checks | `platform-api` / `platform-admin` as today | `edge-admin-api` / `edge-admin-web` — never accepted by ERP guards |

**Forbidden:** Repurposing `platform-admin` client or realm role as Edge operator identity.

---

## 2. Cookies & BFF sessions

| Cookie / secret | Owner | Change policy |
|-----------------|-------|---------------|
| `edge_bff_session` (+ chunks) | ERP BFF (`lib/bff/session.ts`) | **MUST remain** name, semantics, `SESSION_SECRET` binding |
| `okapi_edge_session` (and related `okapi_edge_*`) | Edge console BFF | **NEW only** — separate secret, TTL, path/prefix as ADR-016 |
| PKCE state / verifier storage | Per-flow | Separate cookie/session namespaces; no shared iron-session options object |

Logout / revocation of one stack **MUST NOT** clear or rotate the other stack’s cookies (constraint 2).

---

## 3. Frontend routes & chrome

| Surface | ERP (unchanged) | Edge (new) |
|---------|-----------------|------------|
| Route group | `app/(shell)/**` | `app/(edge-console)/**` |
| Org Switcher | `components/shell/org-switcher.tsx` | **Absent** from Edge chrome |
| Auth API | `/api/auth/*` | `/api/edge-auth/*` |
| Backend proxy | `/api/backend/[...path]` | `/api/edge-backend/[...path]` |
| Keycloak client env | `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` → `platform-web` | Distinct Edge public client id env (no overwrite of ERP default) |

---

## 4. Backend HTTP API

| Prefix / area | Policy |
|---------------|--------|
| Existing `/api/v1/platform/**`, `/api/v1/organizations/**`, invitations, memberships, roles, admin tenants, commercial, etc. | **Frozen contracts** — no silent field/behavior changes for Edge |
| New `/api/v1/edge/**` only | All Edge Admin APIs (ADR-017) |
| ERP JWT guard path | Continues requiring `tenant_id` |
| Edge auth path | Separate guard / issuer; does not weaken ERP validator |

Representative ERP endpoints that must keep working unchanged:

| Method | Path (conceptual) | Evidence |
|--------|-------------------|----------|
| GET | `/api/v1/platform/context` | `platform.controller.ts` |
| GET | `/api/v1/platform/organizations` | same |
| POST | `/api/v1/platform/organizations/switch` | same |
| GET | `/api/v1/platform/me/capabilities` | same |
| * | Platform-admin tenant provision / lifecycle | `platform-admin.controller.ts` |
| * | Identity invitations / memberships / delegations / emergency | `src/modules/identity/presentation/controllers/` |

---

## 5. Context & middleware

| Context | ERP | Edge |
|---------|-----|------|
| Request ALS | `TenantContextService` / `tenant_context` | `vertical_workspace_context` (new) |
| Middleware merge | — | **Forbidden** — never combine into one ALS blob |
| FE selector | Org switcher → backend switch + token refresh | Vertical picker → backend validates membership & issues workspace session |

---

## 6. Data / migrations

| Store | ERP | Edge |
|-------|-----|------|
| Control plane tables through `072_*` | Unchanged semantics | Read-only coexistence |
| New Edge tables | — | CP migrations **073+** only (ADR-009) |
| Tenant DB | ERP operational data | **No** Edge Admin SoT tables |
| Invitation / membership tables | `invitations`, `user_organization_memberships`, … | Separate `edge_*` tables |

---

## 7. Observability & audit

| Mechanism | Policy |
|-----------|--------|
| `PgAuditWriter` / `@AuditAction` | **Reuse writer**; add Edge event names (ADR-015) |
| `platform_admin_audit_log` | ERP platform-admin only — do not overload for Edge vertical ops |
| Metrics labels | Do not collapse Edge into `tenant_id` ERP series without explicit design |

---

## 8. Compatibility test obligations (P0-H)

1. ERP login + Org Switcher + invitation accept still pass with Edge feature flags on.  
2. Edge login does not set/clear `edge_bff_session`.  
3. ERP token rejected on `/api/v1/edge/**`; Edge token rejected on ERP guarded routes.  
4. Control-plane migrate 073+ does not alter 001–072 checksums/behavior.  
5. Cookie jar with both sessions: logout Edge leaves ERP session intact and vice versa.
