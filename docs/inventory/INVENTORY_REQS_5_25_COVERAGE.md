# Inventory / Catalog WMS coverage — Requirements 5–25

Status after migrations `024_catalog_product_master` + `025_inventory_wms_depth` and module wiring.

| # | Capability | Status | Primary surfaces |
|---|------------|--------|------------------|
| 5 | Product master | **Done** | `products` extended cols; `PATCH /catalog/products/:id`; metadata/custom/docs/images/attachments/regulatory/storage/handling |
| 6 | Product types | **Done** | `product_type_codes` + `GET /catalog/product-types` (extensible) |
| 7 | Units engine | **Done** | `uom_codes`, `product_uoms`, `uom.engine.ts`, `PUT …/uoms`, `POST …/convert` |
| 8 | Packaging hierarchy | **Done** | `product_packaging_levels`, `packaging.engine.ts`, `PUT/GET …/packaging` |
| 9 | Lot management | **Done** | `stock_lots` lifecycle + manufacturer/supplier/dates; quarantine/recall/dispose |
| 10 | Serialization | **Done** | `stock_serials` status machine + receive/allocate/issue transitions |
| 11 | Location hierarchy | **Done** | Facility → Warehouse → Zone → Location (AISLE/RACK/SHELF/BIN via `parent_id`) |
| 12 | Location types | **Done** | `location_type_codes` + `GET …/location-types` |
| 13 | Stock balance | **Done** | ATP snapshot + `stock_balances` projection upsert |
| 14 | Inventory ledger | **Done** | `inventory_ledger` expanded types/fields; alias via `InventoryMovementEngine` |
| 15 | Movement engine | **Done** | `inventory-movement.engine.ts` — sole mutation rule layer via inventory port |
| 16 | Receiving | **Done** | Expected receipts + QC advance + GR→receive (+ optional holdForQc) |
| 17 | Transfers | **Done** | Full SM draft→…→completed + dispatch/receive; instant complete retained |
| 18 | Reservations | **Done** | PENDING/ACTIVE/PARTIALLY_FULFILLED/… + context fields |
| 19 | Allocation engine | **Done** | Existing `allocation.engine.ts` (FEFO/FIFO/…) |
| 20 | FEFO engine | **Done** | `fefo.allocator.ts` + org policy `enableFefo` |
| 21 | Picking | **Done** | PickTicket≈PickList; tasks; scan; waves/batch/zone fields |
| 22 | Packing | **Done** | `packing_orders` + packages linked |
| 23 | Shipping | **Done** | READY_TO_SHIP → ship/fail/return + cold-chain fields |
| 24 | Returns | **Done** | Customer + supplier validation; RETURN_TO_SUPPLIER stock dispose |
| 25 | Adjustments | **Done** | Controlled `reason_code` + policy approval thresholds / approve API |

## Migrations

- `migrations/tenant/024_catalog_product_master.sql`
- `migrations/tenant/025_inventory_wms_depth.sql`

## Invariants (stock)

- ATP does **not** double-subtract allocated (allocated ⊆ reserved).
- Ledger is append-only; corrections = new entries (`ADJUSTMENT` / `COUNT_ADJUSTMENT` / …).
- Only Inventory repository ports mutate `stock_lots` / ledger.
