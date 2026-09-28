# Warehouse & Logistics Architecture — Waves 1–2 (Phase 7)

## Bounded context

**Owns:** Physical execution — docks, ASN, receiving documents, putaway tasks, warehouse tasks, packing sessions, handling units, wave/pick/ship **orchestration bridges**, offline sync ledger, carrier quotes (adapter), returns logistics docs, reconciliation/ops incidents, cold-chain excursion records.

**Does not own:** Stock ledger, lots quantities, FEFO/ATP/reservation engines, SalesOrder, PurchaseOrder, AR, live carrier networks, fleet/route engines.

**Stock SoT:** [`src/modules/inventory`](../../src/modules/inventory) — Warehouse calls `receiveLot` / fulfillment `commitIssue` only.

## Persistence

PostgreSQL DB-per-tenant (not SurrealDB).

- Wave 1: [`047_warehouse_engine_v1.sql`](../../migrations/tenant/047_warehouse_engine_v1.sql), workflows [`048`](../../migrations/tenant/048_warehouse_workflow_bindings.sql)
- Wave 2: [`049_warehouse_wave2.sql`](../../migrations/tenant/049_warehouse_wave2.sql)

## Module layout

```
src/modules/warehouse/
  presentation/warehouse.controller.ts
  application/warehouse.use-cases.ts
  application/warehouse-wave2.use-cases.ts
  domain/ (lifecycles, putaway.engine, offline-sync, cold-chain, recon, capability gate)
  infrastructure/ (pg repos, noop carrier adapter, providers)
```

## Flows

### Inbound

```
PO (purchasing — no stock)
 → ASN (optional POST /asns/from-purchase-order)
 → Dock appointment (optional)
 → Receiving
 → Accept line → Inventory.receiveLot
 → Putaway task (strategy engine)
 → Complete receiving
```

### Outbound

```
Sales allocations (Inventory)
 → Wave release → Pick → Pack / HU → Shipment
 → Dispatch → Inventory.commitIssue
```

### Wave 2

```
Offline session → sync ops (idempotent)
Carrier adapter.shopRates → persist quotes
Return shipment → disposition
Stuck putaway scan → discrepancy + ops incident → ACKNOWLEDGE/RESOLVE
Temperature reading → excursion → quarantine incident
MCP tools → warehouse UCs (never repos)
```
