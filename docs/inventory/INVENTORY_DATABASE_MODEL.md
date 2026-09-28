# Inventory Database Model

## Existing (tenant) — keep

| Table | Role |
|-------|------|
| `org_warehouses` | Warehouse master |
| `org_warehouse_zones` | Zone under warehouse |
| `org_warehouse_locations` | Bin under zone |
| `products` / `product_skus` / `product_barcodes` / `product_uoms` | Catalog |
| `stock_lots` | Lot projection |
| `inventory_ledger` | Append-only SoT |
| `inventory_reservations` / `inventory_allocations` | Soft holds |
| `inventory_transfers` / `inventory_transfer_lines` | Transfers |
| `inventory_adjustments` | Adjustment documents |
| `stock_serials` | Serial numbers |
| `product_recalls` | Recalls |
| `inventory_*_policies` / inbound / channel allocations | ATP & channel (017–018) |
| `inventory_reorder_policies` | Replenishment (019) |

Migrations: `010`, `016`–`022`.

## Phase 2 additions — `023_inventory_foundation.sql`

### Enhance locations

```sql
-- org_warehouse_zones: kind already exists; add:
location_type, temperature_profile, min_temperature, max_temperature,
allowed_product_types JSONB, active BOOLEAN, metadata JSONB

-- org_warehouse_locations: add:
location_type, capacity, min_temperature, max_temperature,
security_level, active, metadata, barcode
```

### Policies

```sql
inventory_policies (
  organization_id PK,
  allow_negative_stock BOOLEAN DEFAULT false,
  enable_fefo BOOLEAN DEFAULT true,
  expiration_warning_days INT DEFAULT 90,
  require_lot_for_medication BOOLEAN DEFAULT true,
  require_approval_for_adjustment BOOLEAN DEFAULT false,
  adjustment_approval_threshold NUMERIC,
  allow_partial_receiving BOOLEAN DEFAULT true,
  metadata JSONB,
  version INT, updated_at
)
```

### Idempotency

```sql
inventory_idempotency_keys (
  id UUID PK,
  organization_id UUID NOT NULL,
  operation VARCHAR(40) NOT NULL, -- RECEIVE|TRANSFER|ADJUST|RESERVE
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ,
  UNIQUE (organization_id, operation, idempotency_key)
)
```

### Cycle counts

```sql
inventory_count_sessions (
  id, organization_id, warehouse_id,
  scope_type -- FULL|LOCATION|PRODUCT|LOT
  status -- DRAFT|OPEN|COUNTING|PENDING_APPROVAL|POSTED|CANCELLED
  freeze_applied BOOLEAN,
  started_at, completed_at, posted_at,
  created_by, approved_by, notes, version
)

inventory_count_lines (
  id, session_id, sku_id, lot_id, location_id,
  system_qty, counted_qty, variance_qty,
  status -- PENDING|COUNTED|POSTED|SKIPPED
)

inventory_freezes (
  id, organization_id, warehouse_id,
  scope_type, scope_ref_id,
  reason, session_id,
  active BOOLEAN, created_at, released_at
)
```

## Indexes

- Idempotency unique org+operation+key  
- Count lines by session  
- Freezes active by warehouse  

## Integrity rules

- Locations FK to zones; zones FK to warehouses in same org (enforced in app + warehouse ownership checks)
- Count post creates `inventory_adjustments` + ledger, never silent lot UPDATE without ledger
- Ledger entry types may gain `COUNT_ADJUSTMENT` alias mapped to `ADJUSTMENT`
