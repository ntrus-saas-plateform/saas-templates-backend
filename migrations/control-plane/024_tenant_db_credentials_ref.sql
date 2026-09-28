-- Normalize tenant DB credential references to the single env-backed secret name.
UPDATE tenants
SET database_credentials_ref = 'TENANT_DB_PASSWORD',
    updated_at = NOW()
WHERE database_credentials_ref IS DISTINCT FROM 'TENANT_DB_PASSWORD';

INSERT INTO schema_migrations (version) VALUES ('024_tenant_db_credentials_ref')
ON CONFLICT (version) DO NOTHING;
