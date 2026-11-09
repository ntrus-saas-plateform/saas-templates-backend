-- Migration 081: P4 Sales & Commercial Operations — CRM foundation
-- Control-plane only. CommercialAccount ≠ Tenant. No fake provisioning.
-- Consumes P3 marketing leads by reference; does not fork P2 catalog.

-- ---------------------------------------------------------------------------
-- Teams & territories
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  manager_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_sales_teams_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_sales_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  territory_type VARCHAR(32) NOT NULL DEFAULT 'GEOGRAPHIC'
    CHECK (territory_type IN ('GEOGRAPHIC','PRODUCT','VERTICAL','MARKET','SEGMENT','CUSTOM')),
  country VARCHAR(64),
  region VARCHAR(128),
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  market_id UUID REFERENCES edge_commercial_markets(id) ON DELETE SET NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT edge_sales_territories_code_key UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS edge_sales_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES edge_sales_teams(id) ON DELETE CASCADE,
  administrator_id UUID NOT NULL REFERENCES edge_administrators(id) ON DELETE CASCADE,
  member_role VARCHAR(32) NOT NULL DEFAULT 'REPRESENTATIVE'
    CHECK (member_role IN ('MANAGER','REPRESENTATIVE','SPECIALIST','OBSERVER')),
  territory_id UUID REFERENCES edge_sales_territories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, administrator_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_team_members_admin
  ON edge_sales_team_members (administrator_id)
  WHERE active = TRUE;

-- ---------------------------------------------------------------------------
-- Commercial accounts (NOT tenants)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_commercial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number VARCHAR(32) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255),
  account_type VARCHAR(64) NOT NULL DEFAULT 'PROSPECT_ORGANIZATION'
    CHECK (account_type IN (
      'PROSPECT_ORGANIZATION','BUSINESS_ORGANIZATION','CORPORATE_GROUP','HOLDING',
      'SUBSIDIARY','FRANCHISE_GROUP','DISTRIBUTION_PARTNER','RESELLER',
      'STRATEGIC_ACCOUNT','EXISTING_COMMERCIAL_ACCOUNT'
    )),
  status VARCHAR(32) NOT NULL DEFAULT 'PROSPECT'
    CHECK (status IN (
      'PROSPECT','QUALIFIED','ACTIVE_CUSTOMER','INACTIVE','ARCHIVED','MERGED'
    )),
  country VARCHAR(64),
  region VARCHAR(128),
  city VARCHAR(128),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  postal_code VARCHAR(32),
  industry VARCHAR(128),
  company_size VARCHAR(64),
  website VARCHAR(512),
  legal_identifier VARCHAR(128),
  legal_identifier_type VARCHAR(64),
  email_domain_normalized VARCHAR(255),
  phone_normalized VARCHAR(64),
  parent_account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE SET NULL,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  team_id UUID REFERENCES edge_sales_teams(id) ON DELETE SET NULL,
  primary_product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  -- Explicitly NOT a tenant id. Optional post-provisioning references live elsewhere.
  merged_into_account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE SET NULL,
  name_normalized VARCHAR(255) NOT NULL,
  billing_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_sales_commercial_accounts_number_key UNIQUE (account_number)
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_accounts_name_norm
  ON edge_sales_commercial_accounts (name_normalized)
  WHERE status <> 'MERGED';

CREATE INDEX IF NOT EXISTS idx_edge_sales_accounts_legal_id
  ON edge_sales_commercial_accounts (legal_identifier, country)
  WHERE legal_identifier IS NOT NULL AND status <> 'MERGED';

CREATE INDEX IF NOT EXISTS idx_edge_sales_accounts_email_domain
  ON edge_sales_commercial_accounts (email_domain_normalized)
  WHERE email_domain_normalized IS NOT NULL AND status <> 'MERGED';

CREATE INDEX IF NOT EXISTS idx_edge_sales_accounts_owner
  ON edge_sales_commercial_accounts (owner_administrator_id, status);

CREATE TABLE IF NOT EXISTS edge_sales_account_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  relationship_type VARCHAR(64) NOT NULL
    CHECK (relationship_type IN (
      'PARENT_OF','SUBSIDIARY_OF','PARTNER_OF','RESELLER_OF','AFFILIATE_OF','RELATED_TO'
    )),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  UNIQUE (from_account_id, to_account_id, relationship_type),
  CHECK (from_account_id <> to_account_id)
);

CREATE TABLE IF NOT EXISTS edge_sales_account_merge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surviving_account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  merged_account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  actor_id UUID,
  correlation_id UUID,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Contacts & stakeholders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  email_normalized VARCHAR(320),
  phone_normalized VARCHAR(64),
  job_title VARCHAR(255),
  department VARCHAR(128),
  stakeholder_type VARCHAR(64) NOT NULL DEFAULT 'PRIMARY_CONTACT'
    CHECK (stakeholder_type IN (
      'PRIMARY_CONTACT','DECISION_MAKER','ECONOMIC_BUYER','TECHNICAL_BUYER',
      'IT_MANAGER','BUSINESS_OWNER','PROCUREMENT_MANAGER','FINANCE_CONTACT',
      'LEGAL_CONTACT','END_USER_REPRESENTATIVE','EXECUTIVE_SPONSOR',
      'INFLUENCER','PARTNER_REPRESENTATIVE'
    )),
  influence_level VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (influence_level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  communication_preference VARCHAR(32),
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','ARCHIVED')),
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  marketing_lead_id UUID REFERENCES edge_marketing_leads(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_contacts_account
  ON edge_sales_contacts (account_id, status);

CREATE INDEX IF NOT EXISTS idx_edge_sales_contacts_email
  ON edge_sales_contacts (email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_sales_contact_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES edge_sales_contacts(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  role_type VARCHAR(64) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_until TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Sales leads (P3 bridge — sales-side acceptance record)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marketing_lead_id UUID NOT NULL REFERENCES edge_marketing_leads(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN (
      'RECEIVED','PENDING_REVIEW','ACCEPTED','REJECTED','SALES_QUALIFIED',
      'CONVERTED_TO_OPPORTUNITY','RECYCLED','NURTURING_REQUESTED',
      'DUPLICATE','INVALID','UNREACHABLE'
    )),
  account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE SET NULL,
  owner_administrator_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  team_id UUID REFERENCES edge_sales_teams(id) ON DELETE SET NULL,
  product_id UUID REFERENCES edge_products(id) ON DELETE SET NULL,
  vertical_id UUID REFERENCES edge_verticals(id) ON DELETE SET NULL,
  marketing_score NUMERIC(10,4),
  sales_priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (sales_priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  rejection_reason_code VARCHAR(64),
  rejection_reason_text TEXT,
  qualification JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  sla_due_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  CONSTRAINT edge_sales_leads_marketing_unique UNIQUE (marketing_lead_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_leads_status
  ON edge_sales_leads (status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_edge_sales_leads_owner
  ON edge_sales_leads (owner_administrator_id, status);

CREATE TABLE IF NOT EXISTS edge_sales_lead_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_lead_id UUID NOT NULL REFERENCES edge_sales_leads(id) ON DELETE CASCADE,
  decision_type VARCHAR(32) NOT NULL
    CHECK (decision_type IN (
      'ACCEPT','REJECT','REQUEST_INFO','QUALIFY','RECYCLE','MARK_DUPLICATE',
      'MARK_INVALID','MARK_UNREACHABLE','ASSIGN','NURTURE'
    )),
  from_status VARCHAR(32) NOT NULL,
  to_status VARCHAR(32) NOT NULL,
  reason_code VARCHAR(64),
  reason_text TEXT,
  actor_id UUID,
  correlation_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_lead_decisions_lead
  ON edge_sales_lead_decisions (sales_lead_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- CRM foundation: notes, timeline, tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_sales_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE CASCADE,
  sales_lead_id UUID REFERENCES edge_sales_leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'TEAM'
    CHECK (visibility IN ('PRIVATE','TEAM','MANAGEMENT')),
  author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    account_id IS NOT NULL OR contact_id IS NOT NULL OR sales_lead_id IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS edge_sales_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE SET NULL,
  sales_lead_id UUID REFERENCES edge_sales_leads(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  provenance VARCHAR(32) NOT NULL DEFAULT 'SALES'
    CHECK (provenance IN ('SALES','MARKETING','SYSTEM','EXTERNAL')),
  title VARCHAR(255) NOT NULL,
  body TEXT,
  actor_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_timeline_account
  ON edge_sales_timeline_events (account_id, occurred_at DESC)
  WHERE account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS edge_sales_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES edge_sales_commercial_accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES edge_sales_contacts(id) ON DELETE SET NULL,
  sales_lead_id UUID REFERENCES edge_sales_leads(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','DONE','CANCELLED')),
  priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM'
    CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  due_at TIMESTAMPTZ,
  assignee_id UUID REFERENCES edge_administrators(id) ON DELETE SET NULL,
  created_by UUID,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_edge_sales_tasks_assignee
  ON edge_sales_tasks (assignee_id, status, due_at);

-- Account number sequence helper
CREATE SEQUENCE IF NOT EXISTS edge_sales_account_number_seq START 1000;

-- ---------------------------------------------------------------------------
-- Permissions (platform:sales:* — Edge RBAC convention)
-- ---------------------------------------------------------------------------

INSERT INTO edge_permissions (code, description)
VALUES
  ('platform:sales:accounts:read', 'Read commercial accounts'),
  ('platform:sales:accounts:create', 'Create commercial accounts'),
  ('platform:sales:accounts:update', 'Update commercial accounts'),
  ('platform:sales:accounts:merge', 'Merge commercial accounts'),
  ('platform:sales:contacts:read', 'Read sales contacts'),
  ('platform:sales:contacts:manage', 'Manage sales contacts'),
  ('platform:sales:teams:read', 'Read sales teams'),
  ('platform:sales:teams:manage', 'Manage sales teams and territories'),
  ('platform:sales:leads:read', 'Read sales lead inbox'),
  ('platform:sales:leads:accept', 'Accept sales leads'),
  ('platform:sales:leads:reject', 'Reject sales leads'),
  ('platform:sales:leads:assign', 'Assign sales leads'),
  ('platform:sales:leads:qualify', 'Qualify sales leads'),
  ('platform:sales:opportunities:read', 'Read opportunities'),
  ('platform:sales:opportunities:create', 'Create opportunities'),
  ('platform:sales:opportunities:update', 'Update opportunities'),
  ('platform:sales:opportunities:close', 'Close opportunities'),
  ('platform:sales:pipeline:manage', 'Manage sales pipeline stages'),
  ('platform:sales:activities:manage', 'Manage sales activities and tasks'),
  ('platform:sales:assessments:manage', 'Manage needs assessments'),
  ('platform:sales:quotes:read', 'Read quotes'),
  ('platform:sales:quotes:create', 'Create quotes'),
  ('platform:sales:quotes:approve', 'Approve quotes'),
  ('platform:sales:proposals:manage', 'Manage proposals'),
  ('platform:sales:discounts:request', 'Request discounts'),
  ('platform:sales:discounts:approve', 'Approve discounts'),
  ('platform:sales:contracts:read', 'Read commercial contracts'),
  ('platform:sales:contracts:manage', 'Manage commercial contracts'),
  ('platform:sales:contracts:approve', 'Approve commercial contracts'),
  ('platform:sales:orders:manage', 'Manage sales orders'),
  ('platform:sales:handoff:execute', 'Execute sales handoff'),
  ('platform:sales:forecast:read', 'Read sales forecast'),
  ('platform:sales:analytics:read', 'Read sales analytics'),
  ('platform:sales:governance:manage', 'Manage sales governance')
ON CONFLICT (code) DO NOTHING;

INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
CROSS JOIN edge_permissions p
WHERE r.code = 'EDGE_PLATFORM_SUPER_ADMIN'
  AND p.code LIKE 'platform:sales:%'
ON CONFLICT DO NOTHING;

-- Operator: CRM + lead acceptance (no merge / governance / contracts / handoff)
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:accounts:read',
  'platform:sales:accounts:create',
  'platform:sales:accounts:update',
  'platform:sales:contacts:read',
  'platform:sales:contacts:manage',
  'platform:sales:teams:read',
  'platform:sales:leads:read',
  'platform:sales:leads:accept',
  'platform:sales:leads:reject',
  'platform:sales:leads:assign',
  'platform:sales:leads:qualify',
  'platform:sales:activities:manage',
  'platform:sales:analytics:read'
)
WHERE r.code = 'EDGE_PLATFORM_OPERATOR'
ON CONFLICT DO NOTHING;

-- Vertical roles: read-only sales visibility
INSERT INTO edge_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM edge_roles r
INNER JOIN edge_permissions p ON p.code IN (
  'platform:sales:accounts:read',
  'platform:sales:contacts:read',
  'platform:sales:teams:read',
  'platform:sales:leads:read',
  'platform:sales:analytics:read'
)
WHERE r.code IN ('VERTICAL_OWNER', 'VERTICAL_ADMIN')
ON CONFLICT DO NOTHING;
