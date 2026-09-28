# Inventory Implementation Discovery

**Date:** 2026-09-11  
**Scope:** Pharmaceutical Inventory / WMS — Phase 0 discovery against the live platform codebase.

## Verdict

The commercial stack already provides a **usable pharmaceutical inventory core** on **PostgreSQL (DB-per-tenant)**. Do **not** rewrite Catalog or Inventory. Extend them.

SurrealDB is **not** used for tenant business data ([`docs/COMMERCIAL-ARCHITECTURE.md`](../COMMERCIAL-ARCHITECTURE.md)).

Legacy `commerce` remains dropped (`015_drop_commerce.sql`).

## What exists today

| Capability | Status | Location |
|------------|--------|----------|
| Product master (SKU, barcodes, UOM, pharma flags, kits, substitutions) | Done | `src/modules/catalog` |
| Stock lots + quality statuses | Done | `stock_lots`, `src/modules/inventory` |
| Append-only ledger | Done | `inventory_ledger` |
| FEFO / ATP / reserve / allocate | Done | inventory engines + use-cases |
| Receive / transfer / adjust | Done | `POST /inventory/receive\|transfers\|adjustments` |
| Quarantine / recall | Done | lots + `product_recalls` |
| Serial tracking table | Partial | `stock_serials` (021) |
| Warehouses CRUD | Done | org-ops `organizations/:id/warehouses` |
| Zones / locations **tables** | Done | `org_warehouse_zones`, `org_warehouse_locations` (010) |
| Zones / locations **API** | **Missing** | — |
| Purchasing GR → receive | Done | `src/modules/purchasing` |
| Fulfillment pick/ship → commitIssue | Done | `src/modules/fulfillment` |
| HTTP Idempotency-Key on stock commands | **Missing** | POS offline only |
| Cycle count / stocktake sessions | **Missing** | adjust only |
| Tenant inventory policies | **Missing** | hard-coded / product flags |
| Cold-chain continuous monitoring | Thin | lot temperature fields only |
| Cycle freeze | **Missing** | — |

## Module map

```text
catalog → product SoT
inventory → stock SoT (lots + ledger)
purchasing → goods receipt → inventory.receive
sales / pos → reserve / allocate / confirm
fulfillment → pick / ship → inventory.commitIssue
returns → restock / dispose via inventory port
identity org-ops → warehouses (+ zones/locations to add)
```

**Golden rule:** only Inventory ports mutate stock quantities / ledger.

## Current HTTP surface (`/api/v1/inventory`)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/receive` | `inventory:receive` |
| POST | `/lots/:lotId/quarantine` | `inventory:adjust` (also quarantine perm in later seeds) |
| POST | `/lots/:lotId/recall` | `inventory:adjust` |
| POST | `/recalls` | `inventory:adjust` |
| GET | `/availability` | `inventory:read` |
| POST | `/availability/check` | `inventory:read` |
| POST | `/ctp` | `inventory:read` |
| POST | `/reserve` | `inventory:reserve` |
| POST | `/allocate` | `inventory:allocate` |
| GET/POST | `/consignment-accounts` | `inventory:read` / `receive` |
| POST | `/transfers` | `inventory:transfer` |
| POST | `/adjustments` | `inventory:adjust` |
| GET | `/ledger/reconstruct` | `inventory:read` |
| GET | `/ledger/explain` | `explain:read` |

## Schema anchors (tenant)

- `010` — warehouses, zones, locations, POS
- `016` — products, skus, stock_lots, inventory_ledger, reservations, allocations
- `017`–`022` — ATP policies, transfers, adjustments, serials, recalls, read models

## Permissions (control-plane)

Base: `041_commercial_permissions.sql` — `inventory:read|receive|adjust|reserve|allocate|release`  
Extensions: `044`–`048` — kits, purchasing, transfer, quarantine/recall, explain

## Gaps vs enterprise checklist (prioritized for Phase 2)

1. Location master APIs + placement capability columns  
2. Tenant inventory policies  
3. Idempotency-Key on receive / transfer / adjust / reserve  
4. Cycle count sessions + freeze + variance → adjust  

Later: cold-chain excursions, disposal workflows, genealogy APIs, 3D occupancy, forecasting ML, bulk import.

## Decision

| Item | Choice |
|------|--------|
| Persistence | PostgreSQL DB-per-tenant |
| Strategy | Extend catalog + inventory + org-ops |
| Application style | Use-case classes + outbox |
| Stock mutations | Inventory ports only |

## Related docs

- `docs/COMMERCIAL-ARCHITECTURE.md`, `COMMERCIAL-ENGINE.md`, `COMMERCIAL-CONSISTENCY.md`
- This folder: architecture / domain / DB / API / events / security
