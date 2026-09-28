-- Migration 010: Organization-scoped warehouses / POS / workflows shell

CREATE TABLE IF NOT EXISTS org_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_warehouses_org
  ON org_warehouses (organization_id);

CREATE TABLE IF NOT EXISTS org_warehouse_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES org_warehouses(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(50) NOT NULL DEFAULT 'GENERAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS org_warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES org_warehouse_zones(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (zone_id, code)
);

CREATE TABLE IF NOT EXISTS org_pos_terminals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID REFERENCES org_warehouses(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  offline_enabled BOOLEAN NOT NULL DEFAULT false,
  receipt_template VARCHAR(100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_pos_org
  ON org_pos_terminals (organization_id);

CREATE TABLE IF NOT EXISTS org_cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  pos_terminal_id UUID REFERENCES org_pos_terminals(id) ON DELETE SET NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  is_default BOOLEAN NOT NULL DEFAULT false,
  opening_balance NUMERIC(18, 4) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_cash_registers_org
  ON org_cash_registers (organization_id);

CREATE TABLE IF NOT EXISTS org_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  kind VARCHAR(50) NOT NULL
    CHECK (kind IN (
      'PURCHASE_APPROVAL',
      'DISCOUNT_APPROVAL',
      'STOCK_ADJUSTMENT_APPROVAL',
      'REFUND_APPROVAL',
      'EXPENSE_APPROVAL',
      'LEAVE_APPROVAL',
      'CUSTOM'
    )),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_workflows_org
  ON org_workflows (organization_id);

CREATE TABLE IF NOT EXISTS org_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES org_workflows(id) ON DELETE CASCADE,
  step_index SMALLINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  approver_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  approver_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  threshold JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation JSONB NOT NULL DEFAULT '{}'::jsonb,
  sla_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id, step_index)
);

INSERT INTO schema_migrations (version) VALUES ('010_organization_ops_shell')
ON CONFLICT DO NOTHING;
