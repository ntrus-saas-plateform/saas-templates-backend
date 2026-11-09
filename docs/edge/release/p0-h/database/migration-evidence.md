# P0-H.1 — Migration Evidence Summary

## Commands executed

| Command | Environment | Exit | Result |
|---------|-------------|------|--------|
| `TESTCONTAINERS=true pnpm exec vitest run --config ./vitest.config.integration.ts test/integration/edge-db-qualification.spec.ts` | Windows, Docker Desktop 29.9.2, Vitest 4.1.11 | **0** | **18/18 PASS** |
| `psql --version` | Host | 0 | PostgreSQL 18.3 client |
| Host `pnpm migrate:control` | Local PG 18 service | — | **NOT EXECUTED** (password auth failed for example credentials; no `.env` secrets in workspace) |

## Automated coverage mapping

| Category | How to run |
|----------|------------|
| Full Edge DB qualification | `TESTCONTAINERS=true pnpm test:edge:db` |
| Clean install focus | `TESTCONTAINERS=true pnpm test:edge:db:clean` |
| Upgrade focus | `TESTCONTAINERS=true pnpm test:edge:db:upgrade` |
| Integrity focus | `TESTCONTAINERS=true pnpm test:edge:db:integrity` |
| CI | `.github/workflows/ci.yml` → `pnpm test:integration` with `TESTCONTAINERS=true` (includes this spec) |

## Helper

`test/helpers/control-plane-migrate.ts` mirrors `scripts/migrate-control-plane.ts` (single transaction, skip applied, SQL-owned registry rows).

## Production code / migration changes

| File | Reason |
|------|--------|
| `migrations/control-plane/072_drop_industry_permissions.sql` | P1: missing `schema_migrations` insert caused re-apply |
| `migrations/control-plane/073_edge_foundation.sql` | Add partial unique index for active role assignments |
| `package.json` | `test:edge:db*` scripts |
| `vitest.config.integration.ts` | Longer timeouts for Testcontainers migrations |
| `test/helpers/control-plane-migrate.ts` | Shared migrate helper |
| `test/integration/edge-db-qualification.spec.ts` | H.1 qualification suite |
