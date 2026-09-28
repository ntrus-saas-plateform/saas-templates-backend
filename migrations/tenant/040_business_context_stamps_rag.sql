-- Vague 5.1 / §§51–66: transactional BC stamps, RAG metadata, soft-delete timestamps,
-- numbering + document template seeds. PostgreSQL only (no SurrealDB).

-- ========== §65 / §66 sales order context stamps ==========
ALTER TABLE sales_orders
  ADD COLUMN IF NOT EXISTS business_context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS authorization_decision JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sales_orders.business_context_snapshot IS
  'Immutable BC stamp at confirm: profile, configVersion, policyVersion, profileVersion, capabilities';
COMMENT ON COLUMN sales_orders.authorization_decision IS
  'Forensic why-authorized record at confirm (tenant, profile, caps, policy, user, correlationId)';

-- ========== §64 soft-delete timestamps ==========
ALTER TABLE capability_definitions
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE tenant_business_configurations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

UPDATE capability_definitions
SET deprecated_at = COALESCE(deprecated_at, NOW())
WHERE status = 'DEPRECATED' AND deprecated_at IS NULL;

UPDATE business_profiles
SET deprecated_at = COALESCE(deprecated_at, NOW())
WHERE status = 'DEPRECATED' AND deprecated_at IS NULL;

UPDATE tenant_business_configurations
SET archived_at = COALESCE(archived_at, NOW())
WHERE status = 'ARCHIVED' AND archived_at IS NULL;

-- ========== §56 RAG document metadata ==========
CREATE TABLE IF NOT EXISTS business_context_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title VARCHAR(300) NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  uri TEXT,
  content_ref TEXT,
  -- tags: tenantId, organizationId, businessProfile, industry, capability,
  --       policy, regulation, workflow (+ free-form)
  tags JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bc_documents_org
  ON business_context_documents (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_bc_documents_tags
  ON business_context_documents USING GIN (tags);

-- ========== §59 document templates: scope by profile ==========
ALTER TABLE tenant_document_templates
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS profile_code VARCHAR(80),
  ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

INSERT INTO tenant_document_templates
  (document_type, language, name, body_html, is_default, profile_code, status)
SELECT v.document_type, v.language, v.name, v.body_html, v.is_default, v.profile_code, v.status
FROM (VALUES
  ('INVOICE', 'en', 'Default Invoice', '<h1>Invoice {{number}}</h1>', true, NULL::varchar, 'ACTIVE'),
  ('RECEIPT', 'en', 'Default Receipt', '<h1>Receipt {{number}}</h1>', true, NULL, 'ACTIVE'),
  ('PURCHASE_ORDER', 'en', 'Default PO', '<h1>PO {{number}}</h1>', true, NULL, 'ACTIVE'),
  ('DELIVERY_NOTE', 'en', 'Default Delivery Note', '<h1>Delivery {{number}}</h1>', true, NULL, 'ACTIVE'),
  ('CREDIT_NOTE', 'en', 'Default Credit Note', '<h1>Credit {{number}}</h1>', true, NULL, 'ACTIVE'),
  ('PRESCRIPTION', 'en', 'Pharmacy Prescription', '<h1>Rx {{number}}</h1>', true, 'PHARMACY', 'ACTIVE'),
  ('INSURANCE_CLAIM', 'en', 'Insurance Claim', '<h1>Claim {{number}}</h1>', true, 'PHARMACY', 'ACTIVE'),
  ('WAREHOUSE_DOCUMENT', 'en', 'Warehouse Document', '<h1>WH {{number}}</h1>', true, NULL, 'ACTIVE'),
  ('RECEIPT', 'en', 'Restaurant Receipt', '<h1>Table Receipt {{number}}</h1>', true, 'RESTAURANT', 'ACTIVE'),
  ('RECEIPT', 'en', 'Supermarket Receipt', '<h1>Market Receipt {{number}}</h1>', true, 'SUPERMARKET', 'ACTIVE')
) AS v(document_type, language, name, body_html, is_default, profile_code, status)
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_document_templates t
  WHERE t.document_type = v.document_type
    AND t.name = v.name
    AND t.language = v.language
);

-- ========== §60 numbering seeds ==========
INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('FAC', 'FAC-', 6, 'YEAR'),
  ('CLM', 'CLM-', 6, 'YEAR'),
  ('RX', 'RX-', 6, 'YEAR'),
  ('SHP', 'SHP-', 6, 'YEAR'),
  ('DN', 'DN-', 6, 'YEAR'),
  ('CN', 'CN-', 6, 'YEAR'),
  ('SUP', 'SUP-', 6, 'NEVER')
ON CONFLICT DO NOTHING;
