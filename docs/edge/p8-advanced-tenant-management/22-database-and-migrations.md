# 22 — Database and Migrations

## Migration

`migrations/control-plane/108_edge_p8_advanced_tenant_management.sql`

Registered in `schema_migrations` as `108_edge_p8_advanced_tenant_management`.

## Tables

`edge_p8_tenants`, `edge_p8_tenant_tags`, `edge_p8_tenant_notes`, `edge_p8_lifecycle_requests`, `edge_p8_exceptions`, `edge_p8_migration_requests`, `edge_p8_recovery_requests`, `edge_p8_termination_requests`, `edge_p8_reconciliation_runs`, `edge_p8_reconciliation_findings`, `edge_p8_health_snapshots`, `edge_p8_risk_assessments`, `edge_p8_activity_events`, `edge_p8_bulk_operations`, `edge_p8_analytics_snapshots`.

## Constraints

Unique product_tenant_id/code/slug ; check enums ; optimistic `version` ; append-only activity ; exception expiry check.
