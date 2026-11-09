# P0-H.1 — Clean Install Report

| Field | Value |
|-------|--------|
| Status | **PASS** |
| Execution date | 2026-11-09 |
| Engine | Testcontainers `postgres:16-alpine` |
| Command | `TESTCONTAINERS=true pnpm exec vitest run --config ./vitest.config.integration.ts test/integration/edge-db-qualification.spec.ts` |
| Exit | 0 |
| Tests (suite) | 18 passed / 0 failed |

## Procedure

1. Start disposable PostgreSQL 16 via Testcontainers.
2. Apply Control Plane migrations with helper mirroring `scripts/migrate-control-plane.ts` (`applyControlPlaneMigrations`).
3. Assert registry contains `072` and `073`.
4. Assert all `edge_*` tables exist.
5. Assert role/permission seeds.
6. Re-run migrate → all versions skipped (idempotent).

## Results

| Check | Result |
|-------|--------|
| All CP migrations applied on empty DB | PASS |
| `073_edge_foundation` recorded | PASS |
| Edge tables present | PASS |
| Seeds (10 roles, permissions, links) | PASS |
| Second migrate skips all | PASS |
| Vertical seeds lack global create/activate perms | PASS |

## Notes

- Host PostgreSQL 18.3 is installed but developer DB migrate was **NOT EXECUTED** (auth credentials not available in non-interactive session). CI/Testcontainers path is the project’s standard real-Postgres verification.
- Evidence log: terminal run ~114s test duration, exit 0.
