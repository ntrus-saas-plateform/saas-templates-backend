-- Encrypted local secret store (SECRET_PROVIDER=env|local) for per-tenant DB passwords

CREATE TABLE IF NOT EXISTS secret_store (
  reference VARCHAR(255) PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE secret_store IS
  'Per-tenant secrets when Vault is not used. Values encrypted with SECRET_ENCRYPTION_KEY.';

INSERT INTO schema_migrations (version) VALUES ('033_secret_store')
ON CONFLICT (version) DO NOTHING;
