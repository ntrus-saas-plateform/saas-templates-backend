# P10 — Migration apply evidence

**Date :** 2026-11-16  
**Runner :** `pnpm migrate:control`  
**Target :** temporary Postgres 16 (`docker run … postgres:16-alpine` on `localhost:55432`)

## Result

```
Applied 117_edge_p10_acquisition_foundation
Applied 118_edge_p9_remediation_ops
Applied 119_edge_p10_acquisition_role_grants
Control plane migrations complete
```

(Full control-plane chain 001→119 applied cleanly on empty DB.)

## Verification

```sql
SELECT version FROM schema_migrations WHERE version LIKE '%p10%' ORDER BY version;
-- 117_edge_p10_acquisition_foundation
-- 119_edge_p10_acquisition_role_grants

SELECT COUNT(*) FROM information_schema.tables WHERE table_name LIKE 'edge_p10_%';
-- 31
```

**Fix applied during evidence:** `119_edge_p10_acquisition_role_grants.sql` initially omitted `INSERT INTO schema_migrations` — added and re-applied (`Applied 119_…` then recorded).

## Note

Local default `platform_control` credentials failed earlier (28P01). Evidence captured on ephemeral Docker Postgres 16 (`p10-pg-evidence` on `:55432`).
