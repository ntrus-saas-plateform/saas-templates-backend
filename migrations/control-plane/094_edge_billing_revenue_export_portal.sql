-- Migration 094: P6 — revenue recognition policy, accounting export batches, tax pack seeds
-- Recognized revenue is policy-driven and never silently equated to billed amounts.

-- ---------------------------------------------------------------------------
-- Revenue recognition policy (single active method; versioned rules JSON)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_billing_revenue_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  method VARCHAR(32) NOT NULL
    CHECK (method IN ('CASH_BASED_NET','BILLING_BASED','DEFERRED_MANUAL')),
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_billing_revenue_policies_code_key UNIQUE (code)
);

COMMENT ON TABLE edge_billing_revenue_policies IS
  'Defines how recognizedRevenue is computed. CASH_BASED_NET = succeeded payments minus succeeded refunds. '
  'BILLING_BASED = issued invoice totals (explicit non-GAAP unless finance approves). '
  'DEFERRED_MANUAL = leave recognizedRevenue null until ledger postings exist.';

INSERT INTO edge_billing_revenue_policies (code, method, rules, status, version)
VALUES (
  'REVENUE_DEFAULT',
  'CASH_BASED_NET',
  '{"description":"Recognize cash collected net of refunds; never invent ASC-606 deferrals"}'::jsonb,
  'ACTIVE',
  1
)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Accounting export batches (ERP handoff — snapshot artifacts, not live ERP)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_financial_export_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_type VARCHAR(64) NOT NULL DEFAULT 'GENERAL_LEDGER'
    CHECK (export_type IN ('GENERAL_LEDGER','INVOICES','PAYMENTS','REFUNDS','CREDIT_NOTES','FULL')),
  status VARCHAR(32) NOT NULL DEFAULT 'GENERATED'
    CHECK (status IN ('GENERATED','EXPORTED','FAILED','CANCELLED')),
  currency CHAR(3),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  item_count INT NOT NULL DEFAULT 0,
  checksum_sha256 CHAR(64),
  artifact_ref VARCHAR(512),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_edge_financial_export_batches_created
  ON edge_financial_export_batches (created_at DESC);

CREATE TABLE IF NOT EXISTS edge_financial_export_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES edge_financial_export_batches(id) ON DELETE CASCADE,
  entity_type VARCHAR(64) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_financial_export_items_batch_entity UNIQUE (batch_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_financial_export_items_batch
  ON edge_financial_export_items (batch_id);

-- ---------------------------------------------------------------------------
-- Tax jurisdiction pack (Africa / EU SaaS starters — rates are placeholders for ops config)
-- ---------------------------------------------------------------------------

INSERT INTO edge_billing_tax_jurisdictions (code, name, country, rules, status) VALUES
  ('CD_VAT', 'DRC VAT', 'CD', '{"placeholder":true,"note":"Confirm with local tax counsel before production"}'::jsonb, 'ACTIVE'),
  ('CG_VAT', 'Congo VAT', 'CG', '{"placeholder":true}'::jsonb, 'ACTIVE'),
  ('KE_VAT', 'Kenya VAT', 'KE', '{"placeholder":true}'::jsonb, 'ACTIVE'),
  ('SN_VAT', 'Senegal VAT', 'SN', '{"placeholder":true}'::jsonb, 'ACTIVE'),
  ('FR_TVA', 'France TVA', 'FR', '{"placeholder":true,"reverseChargePossible":true}'::jsonb, 'ACTIVE'),
  ('BE_TVA', 'Belgium VAT', 'BE', '{"placeholder":true}'::jsonb, 'ACTIVE'),
  ('CI_VAT', 'Côte d''Ivoire VAT', 'CI', '{"placeholder":true}'::jsonb, 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_billing_tax_rates (jurisdiction_id, category, rate, version)
SELECT j.id, 'STANDARD', v.rate, 1
FROM (
  VALUES
    ('CD_VAT', 0.160000),
    ('CG_VAT', 0.180000),
    ('KE_VAT', 0.160000),
    ('SN_VAT', 0.180000),
    ('FR_TVA', 0.200000),
    ('BE_TVA', 0.210000),
    ('CI_VAT', 0.180000)
) AS v(code, rate)
JOIN edge_billing_tax_jurisdictions j ON j.code = v.code
WHERE NOT EXISTS (
  SELECT 1 FROM edge_billing_tax_rates r
  WHERE r.jurisdiction_id = j.id AND r.category = 'STANDARD'
);

-- Permissions for export / portal
INSERT INTO edge_permissions (code, description) VALUES
  ('platform:billing:exports:execute', 'Generate financial export batches'),
  ('platform:billing:portal:read', 'Read customer billing portal for authorized accounts')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code IN ('platform:billing:exports:execute', 'platform:billing:portal:read')
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:billing:exports:execute',
  'platform:billing:portal:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code = 'platform:billing:portal:read'
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('094_edge_billing_revenue_export_portal')
ON CONFLICT DO NOTHING;
