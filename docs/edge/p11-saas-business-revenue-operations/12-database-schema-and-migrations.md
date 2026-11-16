# 12 — Database schema & migrations

**Migration:** `122_edge_p11_revenue_operations_foundation.sql`

## Highlights

- Permissions + role grants (SUPER_ADMIN full; OPERATOR read subset)
- All `edge_p11_*` tables listed in 03
- CHECK: UNAVAILABLE ⇒ value IS NULL on metric snapshots
- Soft UUID refs — **no hard FKs** into P5/P6 operational tables
- Outbox tenant: `edge-p11-revenue-operations`
