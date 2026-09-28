-- Migration 050: Warehouse delivery execution + POD bridge

CREATE TABLE IF NOT EXISTS warehouse_delivery_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  sales_order_id UUID,
  status VARCHAR(40) NOT NULL DEFAULT 'EXPECTED'
    CHECK (status IN (
      'EXPECTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'CANCELLED'
    )),
  proof_of_delivery JSONB NOT NULL DEFAULT '{}'::jsonb,
  confirmed_by VARCHAR(128),
  confirmed_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, shipment_id)
);
CREATE INDEX IF NOT EXISTS idx_wh_delivery_org_status
  ON warehouse_delivery_executions (organization_id, status, warehouse_id);

INSERT INTO schema_migrations (version) VALUES ('050_warehouse_delivery_pod')
ON CONFLICT DO NOTHING;
