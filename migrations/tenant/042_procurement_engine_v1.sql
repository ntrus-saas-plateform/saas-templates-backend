-- Migration 042: Procurement Engine Wave 1 — supplier depth, RFQ, invoices, 3-way SoT helpers

-- ========== SUPPLIER MASTER ENRICHMENT ==========
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS legal_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS supplier_type VARCHAR(40) NOT NULL DEFAULT 'VENDOR',
  ADD COLUMN IF NOT EXISTS tax_identifier VARCHAR(80),
  ADD COLUMN IF NOT EXISTS registration_number VARCHAR(80),
  ADD COLUMN IF NOT EXISTS country VARCHAR(2),
  ADD COLUMN IF NOT EXISTS delivery_terms VARCHAR(80),
  ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(40) NOT NULL DEFAULT 'UNQUALIFIED',
  ADD COLUMN IF NOT EXISTS minimum_order_value NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

-- Expand lifecycle (drop old check, migrate INACTIVE → SUSPENDED, add new check)
UPDATE suppliers SET status = 'SUSPENDED' WHERE status = 'INACTIVE';
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_status_check;
ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_status_check
  CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'ARCHIVED'
  ));

CREATE TABLE IF NOT EXISTS supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(80),
  role VARCHAR(80),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier
  ON supplier_contacts (organization_id, supplier_id);

CREATE TABLE IF NOT EXISTS supplier_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  address_type VARCHAR(40) NOT NULL DEFAULT 'BILLING'
    CHECK (address_type IN ('BILLING', 'SHIPPING', 'REMIT', 'OTHER')),
  line1 VARCHAR(255) NOT NULL,
  line2 VARCHAR(255),
  city VARCHAR(120),
  region VARCHAR(120),
  postal_code VARCHAR(40),
  country VARCHAR(2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_addresses_supplier
  ON supplier_addresses (organization_id, supplier_id);

CREATE TABLE IF NOT EXISTS supplier_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address_id UUID REFERENCES supplier_addresses(id) ON DELETE SET NULL,
  lead_time_days INT,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, supplier_id, code)
);

CREATE TABLE IF NOT EXISTS supplier_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_type VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500),
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS supplier_category_links (
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES supplier_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, category_id)
);

CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  label VARCHAR(120),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  -- Non-secret payment metadata only (last4 / iban masked); never log full account
  account_last4 VARCHAR(8),
  bank_name VARCHAR(255),
  payment_method VARCHAR(40) NOT NULL DEFAULT 'TRANSFER',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
  supplier_sku VARCHAR(100) NOT NULL,
  supplier_product_name VARCHAR(255),
  supplier_pack_size NUMERIC(18, 4),
  supplier_unit VARCHAR(40),
  minimum_order_quantity NUMERIC(18, 4) NOT NULL DEFAULT 1,
  order_multiple NUMERIC(18, 4) NOT NULL DEFAULT 1,
  lead_time_days INT,
  preferred BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, supplier_id, sku_id),
  UNIQUE (organization_id, supplier_id, supplier_sku)
);
CREATE INDEX IF NOT EXISTS idx_supplier_product_mappings_sku
  ON supplier_product_mappings (organization_id, sku_id);

CREATE TABLE IF NOT EXISTS supplier_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  unit_price NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  moq NUMERIC(18, 4),
  lead_time_days INT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  quantity_break_from NUMERIC(18, 4),
  quantity_break_to NUMERIC(18, 4),
  price_type VARCHAR(40) NOT NULL DEFAULT 'LIST'
    CHECK (price_type IN ('LIST', 'CONTRACT', 'NEGOTIATED', 'PROMO')),
  source_price_id UUID,
  changed_by VARCHAR(100),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_supplier_price_history_lookup
  ON supplier_price_history (organization_id, supplier_id, sku_id, created_at DESC);

ALTER TABLE supplier_contracts
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(80),
  ADD COLUMN IF NOT EXISTS delivery_terms VARCHAR(80),
  ADD COLUMN IF NOT EXISTS minimum_commitment NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS sla JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS renewed_from_id UUID,
  ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS termination_reason TEXT;

ALTER TABLE supplier_prices
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS quantity_break_from NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS quantity_break_to NUMERIC(18, 4),
  ADD COLUMN IF NOT EXISTS price_type VARCHAR(40) NOT NULL DEFAULT 'LIST',
  ADD COLUMN IF NOT EXISTS preferred BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

UPDATE supplier_prices sp
SET organization_id = s.organization_id
FROM suppliers s
WHERE sp.supplier_id = s.id AND sp.organization_id IS NULL;

-- ========== PR enrichment ==========
ALTER TABLE purchase_requisitions DROP CONSTRAINT IF EXISTS purchase_requisitions_status_check;
ALTER TABLE purchase_requisitions
  ADD CONSTRAINT purchase_requisitions_status_check
  CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'CONVERTED'
  ));
ALTER TABLE purchase_requisitions
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS department VARCHAR(120),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS estimated_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_state VARCHAR(40);

-- ========== RFQ / QUOTATIONS ==========
CREATE TABLE IF NOT EXISTS purchase_rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rfq_number VARCHAR(50) NOT NULL,
  requisition_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN (
      'DRAFT', 'OPEN', 'RESPONSES_RECEIVED', 'EVALUATION', 'AWARDED', 'CLOSED', 'CANCELLED'
    )),
  requested_delivery_at TIMESTAMPTZ,
  response_deadline TIMESTAMPTZ,
  terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  awarded_quotation_id UUID,
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, rfq_number)
);
CREATE INDEX IF NOT EXISTS idx_purchase_rfqs_org_status
  ON purchase_rfqs (organization_id, status);

CREATE TABLE IF NOT EXISTS purchase_rfq_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES purchase_rfqs(id) ON DELETE CASCADE,
  sku_id UUID NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  notes TEXT,
  line_no INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS purchase_rfq_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES purchase_rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  status VARCHAR(30) NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED', 'VIEWED', 'RESPONDED', 'DECLINED', 'EXPIRED')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE (rfq_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rfq_id UUID NOT NULL REFERENCES purchase_rfqs(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  quotation_number VARCHAR(50) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'WITHDRAWN', 'SELECTED', 'REJECTED')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  valid_until TIMESTAMPTZ,
  payment_terms VARCHAR(80),
  delivery_terms VARCHAR(80),
  lead_time_days INT,
  discount_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, quotation_number)
);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_rfq
  ON supplier_quotations (organization_id, rfq_id);

CREATE TABLE IF NOT EXISTS supplier_quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
  rfq_line_id UUID REFERENCES purchase_rfq_lines(id) ON DELETE SET NULL,
  sku_id UUID NOT NULL,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4) NOT NULL,
  moq NUMERIC(18, 4),
  lead_time_days INT,
  line_total NUMERIC(18, 4) NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS supplier_selection_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  rfq_id UUID NOT NULL REFERENCES purchase_rfqs(id) ON DELETE CASCADE,
  selected_quotation_id UUID NOT NULL REFERENCES supplier_quotations(id),
  selected_supplier_id UUID NOT NULL REFERENCES suppliers(id),
  comparison_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  actor_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== PO enrichment ==========
ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
UPDATE purchase_orders SET status = 'PENDING_APPROVAL' WHERE status = 'APPROVAL';
ALTER TABLE purchase_orders
  ADD CONSTRAINT purchase_orders_status_check
  CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'ACKNOWLEDGED',
    'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'BACKORDERED', 'CANCELLED', 'CLOSED',
    -- legacy alias kept for in-flight rows until remapped
    'RECEIVED', 'APPROVAL'
  ));

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_rfq_id UUID REFERENCES purchase_rfqs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES supplier_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(80),
  ADD COLUMN IF NOT EXISTS delivery_terms VARCHAR(80),
  ADD COLUMN IF NOT EXISTS approval_state VARCHAR(40),
  ADD COLUMN IF NOT EXISTS backorder_qty NUMERIC(18, 4) NOT NULL DEFAULT 0;

UPDATE purchase_orders SET status = 'FULLY_RECEIVED' WHERE status = 'RECEIVED';

ALTER TABLE purchase_order_lines
  ADD COLUMN IF NOT EXISTS quantity_backordered NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_rejected NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_damaged NUMERIC(18, 4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchase_order_backorders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  purchase_order_line_id UUID NOT NULL REFERENCES purchase_order_lines(id) ON DELETE CASCADE,
  quantity NUMERIC(18, 4) NOT NULL,
  expected_at TIMESTAMPTZ,
  supplier_confirmed BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'RESCHEDULED', 'CANCELLED', 'FULFILLED')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_po_backorders_po
  ON purchase_order_backorders (organization_id, purchase_order_id);

ALTER TABLE goods_receipt_lines
  ADD COLUMN IF NOT EXISTS quantity_damaged NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_rejected NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_accepted NUMERIC(18, 4);

UPDATE goods_receipt_lines
SET quantity_accepted = quantity
WHERE quantity_accepted IS NULL;

-- ========== SUPPLIER INVOICE (procurement document, not AP ledger) ==========
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  invoice_number VARCHAR(80) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'POSTED', 'VOID', 'MATCHED', 'DISPUTED')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  invoice_date DATE,
  due_date DATE,
  subtotal NUMERIC(18, 4) NOT NULL DEFAULT 0,
  tax_total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  total NUMERIC(18, 4) NOT NULL DEFAULT 0,
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, supplier_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_po
  ON supplier_invoices (organization_id, purchase_order_id);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  purchase_order_line_id UUID,
  sku_id UUID,
  description TEXT,
  quantity NUMERIC(18, 4) NOT NULL,
  unit_price NUMERIC(18, 4) NOT NULL,
  tax_amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
  line_total NUMERIC(18, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS supplier_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  credit_number VARCHAR(50) NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  purchase_order_id UUID,
  goods_receipt_id UUID,
  return_id UUID,
  supplier_invoice_id UUID REFERENCES supplier_invoices(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ISSUED', 'APPLIED', 'VOID')),
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  amount NUMERIC(18, 4) NOT NULL,
  reason TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, credit_number)
);

CREATE TABLE IF NOT EXISTS landed_cost_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_number VARCHAR(50) NOT NULL,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  goods_receipt_id UUID REFERENCES goods_receipts(id) ON DELETE SET NULL,
  allocation_method VARCHAR(40) NOT NULL DEFAULT 'BY_VALUE'
    CHECK (allocation_method IN ('BY_VALUE', 'BY_QUANTITY', 'BY_WEIGHT', 'BY_VOLUME', 'EXPLICIT')),
  freight NUMERIC(18, 4) NOT NULL DEFAULT 0,
  insurance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  customs NUMERIC(18, 4) NOT NULL DEFAULT 0,
  port_fees NUMERIC(18, 4) NOT NULL DEFAULT 0,
  handling NUMERIC(18, 4) NOT NULL DEFAULT 0,
  other_cost NUMERIC(18, 4) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'ALLOCATED', 'VOID')),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, document_number)
);

CREATE TABLE IF NOT EXISTS landed_cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES landed_cost_documents(id) ON DELETE CASCADE,
  purchase_order_line_id UUID,
  goods_receipt_line_id UUID,
  sku_id UUID NOT NULL,
  allocated_amount NUMERIC(18, 4) NOT NULL,
  unit_amount NUMERIC(18, 4),
  basis_value NUMERIC(18, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== CAPABILITIES ==========
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('SUPPLIER_MANAGEMENT', 'Supplier management', 'Supplier master lifecycle', 'PROCUREMENT', 'AVAILABLE', '["purchasing"]'::jsonb, '["*"]'::jsonb),
  ('RFQ', 'RFQ', 'Request for quotation', 'PROCUREMENT', 'AVAILABLE', '["purchasing"]'::jsonb, '["*"]'::jsonb),
  ('SUPPLIER_QUOTATION', 'Supplier quotation', 'Supplier quotes and comparison', 'PROCUREMENT', 'AVAILABLE', '["purchasing"]'::jsonb, '["*"]'::jsonb),
  ('THREE_WAY_MATCH', 'Three-way match', 'PO / GR / supplier invoice match', 'PROCUREMENT', 'AVAILABLE', '["purchasing"]'::jsonb, '["*"]'::jsonb),
  ('LANDED_COST', 'Landed cost', 'Landed cost allocation documents', 'PROCUREMENT', 'AVAILABLE', '["purchasing","inventory"]'::jsonb, '["*"]'::jsonb),
  ('SUPPLIER_RETURNS', 'Supplier returns', 'Return-to-supplier coordination', 'PROCUREMENT', 'AVAILABLE', '["purchasing","inventory"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  required_modules = EXCLUDED.required_modules,
  supported_verticals = EXCLUDED.supported_verticals,
  updated_at = NOW();

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('SUPPLIER_MANAGEMENT', 'PURCHASING'),
  ('RFQ', 'PURCHASING'),
  ('SUPPLIER_QUOTATION', 'RFQ'),
  ('THREE_WAY_MATCH', 'PURCHASING'),
  ('LANDED_COST', 'PURCHASING'),
  ('SUPPLIER_RETURNS', 'PURCHASING')
ON CONFLICT DO NOTHING;

-- Compose into profiles that already include PURCHASING
UPDATE business_profiles
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT c), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(default_capabilities) AS c
    UNION ALL SELECT 'SUPPLIER_MANAGEMENT'
    UNION ALL SELECT 'RFQ'
    UNION ALL SELECT 'SUPPLIER_QUOTATION'
    UNION ALL SELECT 'THREE_WAY_MATCH'
    UNION ALL SELECT 'LANDED_COST'
    UNION ALL SELECT 'SUPPLIER_RETURNS'
  ) x
),
updated_at = NOW()
WHERE default_capabilities @> '["PURCHASING"]'::jsonb
   OR default_modules @> '["purchasing"]'::jsonb;

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('RFQ', 'RFQ-', 6, 'YEAR'),
  ('SQ', 'SQ-', 6, 'YEAR'),
  ('SIN', 'SIN-', 6, 'YEAR'),
  ('SCR', 'SCR-', 6, 'YEAR'),
  ('LCD', 'LCD-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('042_procurement_engine_v1') ON CONFLICT DO NOTHING;
