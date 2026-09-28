-- Migration 049: Warehouse Wave 2 — offline, carriers, returns logistics, reconciliation, cold-chain, ops

-- ========== OFFLINE SYNC ==========
CREATE TABLE IF NOT EXISTS warehouse_offline_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  operator_id VARCHAR(128) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  config_version INT NOT NULL DEFAULT 0,
  business_context_version INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'CLOSED', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  UNIQUE (organization_id, device_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_offline_sessions_wh
  ON warehouse_offline_sessions (organization_id, warehouse_id, status);

CREATE TABLE IF NOT EXISTS warehouse_offline_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  device_id VARCHAR(128) NOT NULL,
  operator_id VARCHAR(128) NOT NULL,
  session_id VARCHAR(128) NOT NULL,
  client_operation_id VARCHAR(128) NOT NULL,
  sequence_no BIGINT NOT NULL DEFAULT 0,
  operation_type VARCHAR(60) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key VARCHAR(128) NOT NULL,
  local_timestamp TIMESTAMPTZ,
  server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  config_version INT,
  business_context_version INT,
  sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
    CHECK (sync_status IN ('PENDING', 'PROCESSING', 'APPLIED', 'CONFLICT', 'REJECTED')),
  server_result JSONB,
  reject_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, device_id, client_operation_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_offline_ops_wh_status
  ON warehouse_offline_operations (organization_id, warehouse_id, sync_status);

-- ========== CARRIERS ==========
CREATE TABLE IF NOT EXISTS warehouse_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(255) NOT NULL,
  adapter_code VARCHAR(40) NOT NULL DEFAULT 'noop'
    CHECK (adapter_code IN ('noop', 'http_stub')),
  services JSONB NOT NULL DEFAULT '["STANDARD"]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS warehouse_carrier_rate_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  carrier_id UUID REFERENCES warehouse_carriers(id) ON DELETE SET NULL,
  shipment_id UUID,
  service_code VARCHAR(40) NOT NULL DEFAULT 'STANDARD',
  amount NUMERIC(18, 4) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  eta_hours INT,
  quote_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========== RETURNS LOGISTICS ==========
CREATE TABLE IF NOT EXISTS warehouse_return_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  return_shipment_number VARCHAR(50) NOT NULL,
  commercial_return_id UUID,
  sales_order_id UUID,
  carrier_id UUID,
  tracking_number VARCHAR(100),
  status VARCHAR(40) NOT NULL DEFAULT 'AUTHORIZED'
    CHECK (status IN (
      'AUTHORIZED', 'IN_TRANSIT', 'ARRIVED', 'RECEIVING', 'INSPECTING',
      'DISPOSITIONED', 'CANCELLED'
    )),
  disposition VARCHAR(40)
    CHECK (disposition IS NULL OR disposition IN (
      'RESTOCK', 'RESTOCK_AS_NEW', 'RESTOCK_DAMAGED', 'QUARANTINE',
      'RETURN_TO_SUPPLIER', 'REPAIR', 'SCRAP', 'DESTROY'
    )),
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, return_shipment_number)
);

-- ========== RECONCILIATION ==========
CREATE TABLE IF NOT EXISTS warehouse_reconciliation_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  discrepancy_type VARCHAR(60) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  aggregate_type VARCHAR(60),
  aggregate_id UUID,
  correlation_id VARCHAR(64),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'ESCALATED')),
  root_cause TEXT,
  resolution TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  actor_id VARCHAR(128),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_wh_recon_org_status
  ON warehouse_reconciliation_discrepancies (organization_id, status, severity);

-- ========== OPS CENTER ==========
CREATE TABLE IF NOT EXISTS warehouse_ops_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID,
  incident_type VARCHAR(60) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
    CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'ESCALATED')),
  reference_type VARCHAR(60),
  reference_id UUID,
  acknowledged_by VARCHAR(128),
  resolved_by VARCHAR(128),
  notes TEXT,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wh_ops_org_status
  ON warehouse_ops_incidents (organization_id, status, severity);

-- ========== COLD CHAIN EXCURSIONS ==========
CREATE TABLE IF NOT EXISTS warehouse_temperature_excursions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  location_id UUID,
  lot_id UUID,
  sensor_id VARCHAR(80),
  reading_celsius NUMERIC(8, 2) NOT NULL,
  threshold_min NUMERIC(8, 2),
  threshold_max NUMERIC(8, 2),
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'QUARANTINED', 'CLEARED', 'INVESTIGATING')),
  corrective_action TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cleared_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO tenant_number_sequences (document_type, prefix, pad_length, reset_policy)
VALUES
  ('WRS', 'WRS-', 6, 'YEAR'),
  ('WRECON', 'WRC-', 6, 'YEAR'),
  ('WOPS', 'WOPS-', 6, 'YEAR')
ON CONFLICT DO NOTHING;

-- Capabilities Wave 2
INSERT INTO capability_definitions (code, name, description, category, status, required_modules, supported_verticals)
VALUES
  ('OFFLINE_WAREHOUSE', 'Offline warehouse', 'Offline mobile warehouse sync', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('MOBILE_WAREHOUSE', 'Mobile warehouse', 'Mobile scanner APIs', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('MOBILE_SCANNER', 'Mobile scanner', 'Barcode/GS1 scanning', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('CARRIER', 'Carriers', 'Carrier master + adapters', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('CARRIER_RATE_SHOPPING', 'Carrier rate shopping', 'Rate quotes via carrier adapters', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('TRACKING', 'Shipment tracking', 'Carrier tracking abstraction', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('RETURNS_LOGISTICS', 'Returns logistics', 'Return shipment + disposition', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('YARD_MANAGEMENT', 'Yard management', 'Yard / dock yard ops', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["WHOLESALE","*"]'::jsonb),
  ('DOCK_MANAGEMENT', 'Dock management', 'Dock ops beyond appointments', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('WAREHOUSE_WORKFORCE', 'Warehouse workforce', 'Operational workforce (not HR)', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('WAREHOUSE_PERFORMANCE', 'Warehouse performance', 'Warehouse KPIs', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["*"]'::jsonb),
  ('COLD_CHAIN_LOGISTICS', 'Cold chain logistics', 'Excursion handling in warehouse', 'WAREHOUSE', 'AVAILABLE', '["inventory"]'::jsonb, '["PHARMACY","SUPERMARKET","RESTAURANT","*"]'::jsonb),
  ('ROUTE_PLANNING', 'Route planning', 'Route optimization port', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('DELIVERY', 'Delivery execution', 'Last-mile delivery ops', 'WAREHOUSE', 'AVAILABLE', '["inventory","fulfillment"]'::jsonb, '["*"]'::jsonb),
  ('FLEET', 'Fleet', 'Fleet / vehicle ops', 'WAREHOUSE', 'EXPERIMENTAL', '["inventory"]'::jsonb, '["*"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO capability_dependencies (capability_code, depends_on_code) VALUES
  ('OFFLINE_WAREHOUSE', 'WAREHOUSE'),
  ('MOBILE_WAREHOUSE', 'WAREHOUSE'),
  ('MOBILE_SCANNER', 'MOBILE_WAREHOUSE'),
  ('CARRIER', 'SHIPPING'),
  ('CARRIER_RATE_SHOPPING', 'CARRIER'),
  ('TRACKING', 'CARRIER'),
  ('RETURNS_LOGISTICS', 'WAREHOUSE'),
  ('YARD_MANAGEMENT', 'INBOUND'),
  ('DOCK_MANAGEMENT', 'INBOUND'),
  ('WAREHOUSE_WORKFORCE', 'WAREHOUSE_TASKS'),
  ('WAREHOUSE_PERFORMANCE', 'WAREHOUSE'),
  ('COLD_CHAIN_LOGISTICS', 'WAREHOUSE'),
  ('ROUTE_PLANNING', 'OUTBOUND'),
  ('DELIVERY', 'SHIPPING'),
  ('FLEET', 'DELIVERY')
ON CONFLICT DO NOTHING;

UPDATE business_profiles bp
SET default_capabilities = (
  SELECT COALESCE(jsonb_agg(DISTINCT x), '[]'::jsonb)
  FROM (
    SELECT jsonb_array_elements_text(bp.default_capabilities) AS x
    UNION ALL SELECT 'OFFLINE_WAREHOUSE'
    UNION ALL SELECT 'MOBILE_WAREHOUSE'
    UNION ALL SELECT 'MOBILE_SCANNER'
    UNION ALL SELECT 'CARRIER'
    UNION ALL SELECT 'CARRIER_RATE_SHOPPING'
    UNION ALL SELECT 'RETURNS_LOGISTICS'
    UNION ALL SELECT 'DOCK_MANAGEMENT'
  ) s(x)
)
WHERE default_capabilities @> '["WAREHOUSE"]'::jsonb;

INSERT INTO schema_migrations (version) VALUES ('049_warehouse_wave2')
ON CONFLICT DO NOTHING;
