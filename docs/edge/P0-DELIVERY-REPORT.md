# Okapi Edge Platform P0 — Delivery Report

**Date:** 2026-11-09  
**Classification:** Implementation evidence report (not a claim that the full commercial platform is production-complete)  
**Locked decisions:** Console **1A** (`(edge-console)` + `okapi_edge_*`); Keycloak **2A** (`edge-admin` realm)

---

## 1. Executive summary

P0 delivers an Edge IAM and Vertical Workspace foundation **beside** the existing ERP stack without rewriting repositories or regressing ERP JWT/`tenant_id`/Org Switcher/`edge_bff_session` contracts. Edge administrators authenticate via a dedicated Keycloak realm; vertical workspace sessions are opaque Control-Plane sessions distinct from tenant/org context; the Edge Admin Console is isolated in the existing Next.js app under `/edge` with separate BFF cookies and clients.

## 2. Initial repository audit

See [P0-AUDIT.md](./P0-AUDIT.md). Evidence classifications: VERIFIED / PARTIALLY VERIFIED / NOT VERIFIED.

## 3. Verified existing architecture

- Nest modular monolith: `identity` + `platform` hexagonal modules.
- ERP auth: JWT requires `tenant_id`; Org Switcher refreshes tokens.
- Single historical `platform` realm retained for Business Backend IAM.
- Frontend ERP shell package name `edge-frontend` with cookies `edge_bff_session` / `edge_csrf`.

## 4. Architectural gaps closed in P0

| Gap | Resolution |
|-----|------------|
| No Edge admin aggregate | `edge_administrators` + lifecycle |
| No vertical IAM | `edge_verticals` + memberships |
| Org switch ≠ workspace | Opaque `edge_workspace_sessions` |
| Shared realm mix | Dedicated `edge-admin` realm |
| Cookie namespace collision | `okapi_edge_*` Edge BFF |

## 5. Security findings

| Finding | Severity | Status |
|---------|----------|--------|
| Merging all vertical permissions at EdgeAuthGuard | High | **Fixed** — global-only at auth; vertical+global in workspace guard |
| Vertical admin assigning global roles | High | **Mitigated** — `AssignEdgeRoleUseCase` requires actor global role |
| ERP/Edge session conflation | High | **Mitigated** — separate cookies/clients/realm |
| Frontend-only authz | Medium | UI gates only; backend guards remain SoT |

## 6. ADR decisions

ADR-001…020 under [docs/edge/adr/](./adr/) with constraints: no ERP regression; session/client/context separation; backend authority; adapted-contract coexistence.

## 7. Implemented domain model

Aggregates: PlatformAdministrator, Vertical, VerticalMembership, EdgeInvitation, EdgeRole/Permission/Assignment, WorkspaceSession, EdgeDelegation, EdgeEmergencyAccessGrant, WorkspaceConfigurationVersion.

## 8. Database changes

Control-plane migration [`073_edge_foundation.sql`](../../migrations/control-plane/073_edge_foundation.sql): Edge tables, indexes, permission/role seeds. No tenant-DB Edge tables.

## 9. Migration execution evidence

| Check | Result |
|-------|--------|
| File present & ordered after `072_*` | VERIFIED |
| Clean DB apply in this session | NOT VERIFIED (no live Postgres run in delivery window) |
| Recommendation | `pnpm migrate:control` against clean and upgraded CP DBs before release |

## 10–11. Backend files created / modified

**Created (representative):** `src/modules/edge/**`, `src/shared/auth/edge-*.ts`, `docker/keycloak/edge-admin-realm.json`, `migrations/control-plane/073_edge_foundation.sql`, `docs/edge/**`, `src/shared/observability/edge-metrics.service.ts`.

**Modified (representative):** `app.module.ts`, ERP auth guards (skip `@EdgeRoute`), `environment.schema.ts`, `.env.example`, `observability.module.ts`, `metrics.service.ts`, `authorization.use-cases.ts` (escalation + resolution fixes).

## 12. API contract changes

**Additive only:** `/api/v1/edge/**`. ERP `/api/v1/platform/**`, `/organizations`, `/invitations`, `/memberships`, `/sessions` unchanged by design ([COMPATIBILITY.md](./COMPATIBILITY.md)).

## 13. Keycloak changes

New importable realm `edge-admin` with clients `edge-admin-api` (confidential SA) and `edge-admin-web` (public PKCE). No `tenant_id` mapper. Existing `platform` realm untouched.

## 14–18. Capability implementation

| Area | Status |
|------|--------|
| Identity lifecycle + invitations | Implemented (CP + APIs + domain tests) |
| Vertical lifecycle | Implemented |
| Memberships + RBAC | Implemented; cross-vertical isolation hardened |
| Workspace sessions | Implemented; header `x-edge-workspace-session` |
| Security / emergency / audit APIs | Implemented; runbooks under `docs/edge/runbooks/` |

## 19–21. Frontend

Isolated `(edge-console)` under `/edge`, BFF `/api/edge-auth/*`, `/api/edge-backend/*`, `/api/edge-bootstrap`, cookies `okapi_edge_bff_session` / `okapi_edge_csrf`, workspace switcher (not OrgSwitcher). Pages: overview, verticals, administrators, security, audit, workspace configuration/administration.

## 22. Audit and observability

Edge audit via existing audit patterns + Edge event taxonomy tables/repos. Prometheus counters: `edge_*` family (invitations, memberships, workspace switches, authz denials, sessions, KC sync, reconciliation, audit failures).

## 23. Threat model results (summary)

Scenarios from spec Part 20.2 addressed by design: cross-vertical resource use, privilege escalation to global roles, stale workspace session, ERP↔Edge session confusion, frontend permission cache. Automated coverage is primarily unit/domain; full Keycloak/Testcontainers Edge suite remains a release gate item.

## 24. Test execution results

### Backend

| Command | Environment | Date | Result | Passed | Failed | Skipped |
|---------|-------------|------|--------|--------|--------|---------|
| `pnpm typecheck` | local Windows, saas-templates-backend | 2026-11-09 | **PASS** | — | 0 | — |
| `pnpm exec vitest run src/modules/edge src/shared/auth/edge-jwt-validation.service.spec.ts test/architecture/edge-boundary.spec.ts` | local | 2026-11-09 | **PASS** | 25 | 0 | 0 |

### Frontend

| Command | Environment | Date | Result | Passed | Failed | Skipped |
|---------|-------------|------|--------|--------|--------|---------|
| `pnpm test` | local, saas-template-frontend | 2026-11-09 | **PASS** | 24 | 0 | 0 |
| `pnpm lint` (full repo) | local | 2026-11-09 | **FAIL** (pre-existing non-Edge) | — | — | — |
| Playwright `e2e/edge-smoke.spec.ts` | local | 2026-11-09 | **NOT EXECUTED** (browsers may be missing) | — | — | — |
| ERP Playwright smoke | local | 2026-11-09 | **NOT EXECUTED** this window | — | — | — |

## 25. Build and typecheck

Backend `pnpm typecheck`: PASS (2026-11-09). Frontend full production build: NOT VERIFIED in this window.

## 26. Performance and resilience

Load/resilience Edge baselines: **NOT VERIFIED** (no invented numbers). Track under P0-H follow-up with `pnpm test:load` after environment readiness.

## 27. Deployment requirements

1. Apply CP migration `073_edge_foundation`.
2. Import both Keycloak realms (`platform` + `edge-admin`).
3. Set Edge env vars (`EDGE_KEYCLOAK_*`, `SESSION_SECRET_EDGE`, frontend `NEXT_PUBLIC_EDGE_*`).
4. Confirm redirect URI `http(s)://<host>/api/edge-auth/callback` on `edge-admin-web`.
5. Keep ERP env (`KEYCLOAK_*`, `SESSION_SECRET`) unchanged.

## 28. Operational runbooks

See [docs/edge/runbooks/](./runbooks/).

## 29. Known limitations

- Keycloak Organization auto-provision on vertical create may be partial depending on admin client connectivity; readiness/activation gates prevent false ACTIVE.
- Full Playwright scenarios A–G and Testcontainers Keycloak Edge suite not executed in this delivery window.
- Full-repo frontend lint still fails on pre-existing non-Edge files.

## 30. Outstanding defects

- Pre-existing frontend ESLint failures outside Edge surface.
- Live migration apply + dual-realm compose smoke not evidenced here.

## 31. Deferred capabilities

Product Catalog, Commercial, Subscription, Billing, Tenant productization beyond existing Platform Admin, Business Org IAM — placeholders only.

## 32. P0 acceptance checklist

| Criterion | Status |
|-----------|--------|
| Edge IAM isolated from Business IAM | Met (realm + guards + cookies) |
| Administrator / invitation / vertical / membership / workspace APIs | Met (code + unit tests) |
| Backend authority; no frontend-only security | Met |
| ERP contracts preserved | Met by design; regression e2e NOT EXECUTED |
| ADRs + audit + runbooks | Met |
| Full E2E A–G + load evidence | **Not met** — follow-up gate |

## 33. Final release recommendation

**Conditional:** merge/ship to a staging environment after (1) `pnpm migrate:control` on clean+upgrade DBs, (2) dual-realm Keycloak import smoke, (3) Edge + ERP Playwright smoke, (4) authorization security suite against Testcontainers. **Do not** mark the broader Okapi commercial platform production-ready on P0 alone.
