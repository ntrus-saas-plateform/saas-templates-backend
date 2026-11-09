# P0-H.1 — Database Audit

**Date:** 2026-11-09  
**Repository:** `saas-templates-backend`  
**Status:** Complete (pre-correction + post-correction notes)

## Migration architecture (VERIFIED)

| Item | Finding |
|------|---------|
| Runner | [`scripts/migrate-control-plane.ts`](../../../../scripts/migrate-control-plane.ts) via `pnpm migrate:control` |
| Discovery | `readdirSync(migrations/control-plane).filter(*.sql).sort()` |
| Ordering | Lexicographic filename sort (`001_…` … `073_…`) |
| Registry | Table `schema_migrations (version PK, applied_at)` |
| Skip logic | `SELECT 1 FROM schema_migrations WHERE version = $1` before apply |
| Registry write | **SQL files** insert their own version (`ON CONFLICT DO NOTHING`); runner does not insert |
| Transaction | **Single outer** `BEGIN`/`COMMIT` for the entire migrate run; failure → `ROLLBACK` of all uncommitted work in that run |
| Checksums | **Not** stored |
| Concurrency lock | **Not** implemented (advisory lock absent) |
| Rollback | Forward-only; no down migrations |
| Tenant runner | Separate [`scripts/migrate-tenant.ts`](../../../../scripts/migrate-tenant.ts) reading `migrations/tenant/` only |

## Connection architecture (VERIFIED)

- Control Plane: `CONTROL_PLANE_DB_*` → `platform_control` (defaults in `.env.example`).
- Tenant DBs: resolved from `tenants` row; migrations from `migrations/tenant/`.
- No shared migration directory between CP and tenant.

## Migration 073 structure (VERIFIED)

File: `migrations/control-plane/073_edge_foundation.sql`  
Ordered after `072_drop_industry_permissions.sql` (65 CP SQL files total).

Creates Edge tables: administrators, verticals, memberships, invitations, permissions, roles, role_permissions, role_assignments, workspace_sessions, delegations, emergency_access_grants, configuration_versions, external_identity_mappings, sync_records, audit_events — plus indexes and role/permission seeds.

## Critical gap found in audit

| Defect | Severity | Evidence |
|--------|----------|----------|
| `072_drop_industry_permissions.sql` omitted `INSERT INTO schema_migrations` | **P1** | Only CP file without registry insert; every remigrate re-ran 072 |

**Correction:** added registry insert to `072` (see defects log).

## Local PostgreSQL host

- Service `postgresql-x64-18` **Running**; `psql` reports **18.3**.
- First connection attempt with `.env.example` credentials **failed** (auth).
- Qualification executed via **Testcontainers `postgres:16-alpine`** (project CI path) — real PostgreSQL, disposable.
- Host `pnpm migrate:control` against developer DBs: **NOT EXECUTED** (credentials unavailable without interactive secret).

## Existing test coverage before H.1

- `test/integration/postgres.testcontainers.spec.ts` applies all CP SQL blindly (no skip registry) — partial.
- No dedicated clean vs upgrade-from-072 Edge suite — **gap closed in H.1**.
