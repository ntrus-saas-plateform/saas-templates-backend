-- Migration 017: Optional per-tenant Keycloak realm override

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS keycloak_realm VARCHAR(255);

INSERT INTO schema_migrations (version) VALUES ('017_tenant_keycloak_realm') ON CONFLICT DO NOTHING;
