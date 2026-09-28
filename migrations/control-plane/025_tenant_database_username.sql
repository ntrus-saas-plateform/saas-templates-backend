-- Per-tenant PostgreSQL role + document Keycloak model (single shared realm).

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS database_username VARCHAR(63);

COMMENT ON COLUMN tenants.database_username IS
  'PostgreSQL LOGIN role used by the platform to connect to this tenant database.';

COMMENT ON COLUMN tenants.keycloak_realm IS
  'DEPRECATED and unused. The platform uses one shared Keycloak realm; each tenant has one or more Keycloak Organizations (not a dedicated realm).';

INSERT INTO schema_migrations (version) VALUES ('025_tenant_database_username')
ON CONFLICT (version) DO NOTHING;
