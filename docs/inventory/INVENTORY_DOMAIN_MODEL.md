# Inventory Domain Model

## Aggregates / entities

### Catalog (owned by Catalog module)

- **Product** — type, pharma attributes, lot/serial/expiration tracking flags
- **ProductSku** — sellable unit, links to product
- **ProductBarcode / UOM** — identification and packing conversions

### Inventory

- **StockLot** — physical inventory bucket (warehouse, optional location, SKU, lot number, expiry, quality, ownership, on-hand / reserved / allocated, version)
- **InventoryLedgerEntry** — immutable delta (`RECEIPT`, `SALE`, `TRANSFER_*`, `ADJUSTMENT`, …)
- **InventoryReservation** — soft hold against available stock
- **InventoryAllocation** — FEFO (or policy) assignment of reservation to lots
- **InventoryTransfer** — warehouse-to-warehouse movement (header + lines)
- **InventoryAdjustment** — controlled correction posting to ledger
- **ProductRecall** — recall campaign targeting product/SKU/lot
- **InventoryPolicy** (Phase 2) — org-scoped rules (`allowNegativeStock`, `enableFEFO`, …)
- **CountSession** (Phase 2) — cycle/full count with lines, freeze, variance
- **IdempotencyRecord** (Phase 2) — scoped replay protection for commands

### Location master (Org ops)

- **Warehouse** → **Zone** → **Location (bin)**
- Zone/location carry type + storage capabilities (Phase 2 columns)

## Lot quality statuses

`AVAILABLE | QUARANTINE | RECALLED | EXPIRED | DAMAGED | BLOCKED`

## Invariants (must hold)

1. Ledger is append-only; corrections create new entries.
2. `quantity_reserved <= quantity_on_hand` and `quantity_allocated <= quantity_reserved` on lots (DB checks).
3. Negative on-hand forbidden unless policy `allowNegativeStock=true` (default false; DB currently enforces `>= 0`).
4. Expired / recalled / quarantined lots are not sellable via ATP.
5. Lot-tracked SKUs require lot number on receipt.
6. Serial-tracked SKUs require serials on receipt.
7. Completed transfers are not silently rewritten.
8. Count variance posts only through `AdjustStock` (ledger), never by editing lot without ledger.
9. Idempotent replay of the same key + same payload returns the original result; different payload → conflict.
10. Cross-tenant access is denied at repository / context boundary.

## FEFO

Default allocation prefers earliest `expires_at` among AVAILABLE lots matching warehouse/SKU/ownership policy. Exceptions: recalled/quarantined excluded; reserved lots respected.

## State machines (simplified)

### Transfer

`DRAFT/REQUESTED → APPROVED → IN_TRANSIT → RECEIVED/COMPLETED | CANCELLED`

(Existing transfer use-case may collapse some steps; Phase 3 expands explicit transitions.)

### Count session (Phase 2)

`DRAFT → OPEN (freeze applied) → COUNTING → PENDING_APPROVAL → POSTED | CANCELLED`

### Quarantine

`AVAILABLE → QUARANTINE → RELEASE→AVAILABLE | REJECT→DISPOSAL/DAMAGED`
