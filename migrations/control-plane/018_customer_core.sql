-- Migration 018: Global Customer core (control plane)

CREATE TABLE IF NOT EXISTS global_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(30) NOT NULL DEFAULT 'GUEST'
    CHECK (status IN ('GUEST', 'IDENTIFIED', 'REGISTERED', 'ACTIVE', 'SUSPENDED', 'ANONYMIZED', 'DELETED')),
  type VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (type IN ('INDIVIDUAL', 'BUSINESS', 'GUEST', 'WALK_IN', 'VIP', 'WHOLESALE', 'ONLINE')),
  locale VARCHAR(10) NOT NULL DEFAULT 'en',
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  country VARCHAR(2),
  profile JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_customer_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_customer_id UUID NOT NULL REFERENCES global_customers(id) ON DELETE CASCADE,
  keycloak_subject_id VARCHAR(255),
  external_identity_id VARCHAR(255),
  email_normalized VARCHAR(255),
  phone_normalized VARCHAR(50),
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (global_customer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_global_customer_identity_kc_subject
  ON global_customer_identities(keycloak_subject_id)
  WHERE keycloak_subject_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_customer_identity_email
  ON global_customer_identities(email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_global_customer_identity_phone
  ON global_customer_identities(phone_normalized)
  WHERE phone_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  global_customer_id UUID NOT NULL REFERENCES global_customers(id) ON DELETE CASCADE,
  customer_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED')),
  type VARCHAR(30) NOT NULL DEFAULT 'INDIVIDUAL',
  category VARCHAR(50),
  segment VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}',
  first_purchase_at TIMESTAMPTZ,
  last_purchase_at TIMESTAMPTZ,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(18, 2) NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, global_customer_id),
  UNIQUE (tenant_id, customer_number)
);

CREATE INDEX IF NOT EXISTS idx_tenant_customers_tenant_status
  ON tenant_customers(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_customers_global
  ON tenant_customers(global_customer_id);

CREATE TABLE IF NOT EXISTS organization_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  tenant_customer_id UUID NOT NULL REFERENCES tenant_customers(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED')),
  local_customer_number VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, organization_id, tenant_customer_id),
  FOREIGN KEY (organization_id, tenant_id) REFERENCES organizations(id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_org_customers_org
  ON organization_customers(tenant_id, organization_id);

CREATE TABLE IF NOT EXISTS global_customer_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  global_customer_id UUID NOT NULL REFERENCES global_customers(id) ON DELETE CASCADE,
  purpose VARCHAR(50) NOT NULL,
  policy_version VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('GRANTED', 'WITHDRAWN')),
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  source VARCHAR(50),
  channel VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_customer_consents_customer
  ON global_customer_consents(global_customer_id, purpose, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('018_customer_core') ON CONFLICT DO NOTHING;
