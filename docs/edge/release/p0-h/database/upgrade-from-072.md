# P0-H.1 — Upgrade from 072 Report

| Field | Value |
|-------|--------|
| Status | **PASS** |
| Execution date | 2026-11-09 |
| Engine | Separate Testcontainers DB `platform_control_upgrade` |
| Command | same suite as clean-install (`D — upgrade from 072`) |

## Procedure

1. Apply CP migrations with `stopBeforeVersion: '073_edge_foundation'`.
2. Confirm zero `edge_%` tables.
3. Insert fixture tenant `p0h1-upgrade-tenant` + organization `upgrade-org`.
4. Capture migration count and table count baselines.
5. Run full `applyControlPlaneMigrations` (normal runner semantics).
6. Assert only `073_edge_foundation` newly applied; fixtures preserved; Edge tables present.

## Before / After

| Check | Before | After | Expected |
|-------|--------|-------|----------|
| Edge tables | 0 | 15 | Present |
| Applied this step | through 072 | +073 only | Only outstanding |
| Fixture tenant slug | present | present ACTIVE | Preserved |
| Fixture organization | present | present | Preserved |
| `schema_migrations` count | N | N+1 | +073 |

## Result

**PASS** — upgrade path applies only outstanding migration(s); pre-existing Control Plane data preserved.
