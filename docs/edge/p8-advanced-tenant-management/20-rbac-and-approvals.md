# 20 — RBAC and Approvals

Permissions `platform:tenant_management:*` seeded in migration 108.

Roles :

- `EDGE_PLATFORM_SUPER_ADMIN` — all P8 permissions
- `EDGE_PLATFORM_OPERATOR` — read/search/audit/analytics

Approvals :

- Lifecycle / exception / migration / recovery / termination require distinct approver (SoD)
- Justification obligatoire sur demandes
- Termination sous legal hold bloquée
