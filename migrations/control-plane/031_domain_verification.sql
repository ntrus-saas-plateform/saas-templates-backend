-- Control plane: domain verification fields for tenant_domains

ALTER TABLE tenant_domains
  ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_method VARCHAR(32) NOT NULL DEFAULT 'DNS_TXT',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Custom domains created as PENDING (status column already supports PENDING from 027)
-- SUBDOMAIN domains remain ACTIVE (platform-owned, no verification needed)

INSERT INTO schema_migrations (version) VALUES ('031_domain_verification') ON CONFLICT DO NOTHING;
