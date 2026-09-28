# Identity implementation status

**Status: Backend P2 complete** (OPA adapter, user-level KC reconciliation, feature-flag pagination, live DB scale test)

## P2 gates (2026-09-02)

| Item | Status |
|------|--------|
| OPA / `POLICY_EVALUATOR_PORT` + in-process + optional OPA adapter | ✅ |
| KC user-level reconciliation (drift + repair) | ✅ |
| Feature flags paginated list API | ✅ |
| Load test 1000 tenants (Testcontainers, `TESTCONTAINERS=true`) | ✅ |

## Phase gates

| Phase | Gate | Status |
|-------|------|--------|
| 0 | Architecture tests green | ✅ |
| 3 | Token introspection (optional RFC 7662) | ✅ |
| 3 | Application user status enforced in AuthGuard | ✅ |
| 3 | User lifecycle APIs + KC sync | ✅ |
| 3 | Pagination on roles/permissions/orgs/delegations/sessions | ✅ |
| 3 | Redis token denylist on revoke/suspend | ✅ |
| 3 | Reconciliation reports persisted (tenant-scoped) | ✅ |
| 3 | Identity PG repos in `infrastructure/persistence` | ✅ |
| 3 | Load test 1000 tenant authz contexts | ✅ |
| — | Frontend Keycloak OIDC login | ❌ (skipped by user) |

## Phase 3 (2026-09-02)

### Keycloak
- `TokenIntrospectionService` — RFC 7662 when `KEYCLOAK_TOKEN_INTROSPECTION_ENABLED=true`
- `AuthGuard` — introspection + `isApplicationUserAccessible()` check
- `UserKeycloakLifecycleService` — per-user disable/enable + session revoke on suspend/disable

### User lifecycle
- `GET /v1/users` — paginated list (`users:read`)
- `POST /v1/users/:identityId/suspend` — `users:suspend`
- `POST /v1/users/:identityId/disable` — `users:suspend`
- `POST /v1/users/:identityId/reactivate` — `users:update`
- Events: `user.suspended.v1`, `user.disabled.v1`, `user.reactivated.v1`

### Pagination (extended)
- `GET /v1/roles`, `/permissions`, `/organizations`, `/delegations`, `/emergency-access`, `/sessions`
- Sessions: `{ data: { sessions, keycloakAvailable }, pagination }`

### Token denylist (Redis)
- `TokenDenylistService` — subject `iat` cutoff + optional `jti` keys
- Env: `TOKEN_DENYLIST_ENABLED=true`, `TOKEN_DENYLIST_TTL_SECONDS=86400`
- Triggers: suspend/disable user, tenant suspend, `POST /v1/sessions/revoke-all`

### Pagination (core lists)
- `GET /v1/memberships` — `page`, `limit`
- `GET /v1/invitations` — `page`, `limit`, optional `organizationId`
- List responses: `{ data, pagination }`

### Reconciliation persistence
- Migration `014_reconciliation_reports.sql`
- `PgReconciliationReportRepository` — tenant-scoped history
- `GET /v1/admin/reconciliation/reports` — paginated history
- Job stores per-tenant reports in DB (no global in-memory overwrite)

### Persistence relocation
- 13 identity repos → `modules/identity/infrastructure/persistence/`
- `IdentityPersistenceModule` wired from `DatabaseModule`

## Validation

- `typecheck` ✅
- Unit: 98 ✅ | Security: 15 ✅ | Architecture: 65 ✅ | Load: 4 (+1 Testcontainers) ✅ | E2E: 10 ✅ | `build` ✅

## Active organization

Keycloak JWT + `POST /api/v1/platform/organizations/switch` + token refresh.

Frontend actuel : `edge-frontend` (Next.js staff shell) — Keycloak OIDC via BFF/`keycloak-js`, User Account + Identity settings, platform boot APIs. See [USER-ACCOUNT.md](./USER-ACCOUNT.md) and [IDENTITY.md](./IDENTITY.md). L’ancienne SPA `frontend/platform-web` n’est plus la cible.
