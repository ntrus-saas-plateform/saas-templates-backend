# Inventory Architecture

## Bounded contexts

| Context | Owns | Does not own |
|---------|------|--------------|
| **Catalog** | Product, SKU, barcode, UOM, kits, substitutions, pharma product flags | Quantities, lots on hand |
| **Inventory** | Lots, ledger, reservations, allocations, transfers, adjustments, counts, policies | Sales orders, pick tickets |
| **Org ops (Identity)** | Warehouse / zone / location master data | Ledger postings |
| **Purchasing** | PO / GR documents | Direct lot quantity updates |
| **Sales / POS** | Orders, carts | Direct stock mutation |
| **Fulfillment** | Pick / pack / ship documents | Ledger (calls `commitIssue`) |
| **Returns** | RMA workflow | Calls inventory restock/dispose |

## C4 — containers (logical)

```text
[Edge / POS / Mobile]
        │ REST + JWT (Keycloak)
        ▼
[NestJS Platform API]
  ├── CatalogModule
  ├── InventoryModule  ← stock SoT
  ├── Purchasing / Sales / Fulfillment / Returns
  └── IdentityModule (org warehouses/locations)
        │
        ├── PostgreSQL tenant DB (ledger, lots, …)
        ├── PostgreSQL control plane (RBAC, tenants)
        └── Outbox → messaging (domain events)
```

## Stock mutation path

```text
Command (receive|reserve|allocate|transfer|adjust|count-post|…)
  → UseCase validation (tenant, permissions, product rules, policies)
  → OutboxTransactionService.runWithOutbox
       → InventoryRepository (ledger append + lot projection)
       → enqueue commercial event
  → Response (lot / reservation / availability)
```

## Source of truth

| Kind | Artifact |
|------|----------|
| Transactional SoT | `inventory_ledger` (append-only) |
| Working projection | `stock_lots` quantities + version (optimistic) |
| Availability read | ATP engines + optional `rm_product_availability` |
| Corrections | New ledger entries / adjustments — never UPDATE historical ledger rows |

## Multi-tenancy

- Tenant from JWT only (`CommercialExecutionContext` / `TenantContextService`)
- All inventory queries scoped by tenant pool + `organization_id` / `warehouse_id`
- Organization access via existing org policies where applicable

## Phase 2 additions

- Location APIs under org-ops (zones/locations)
- `inventory_policies` per organization
- `inventory_idempotency_keys` for critical POSTs
- `inventory_count_sessions` / lines + freeze flags

## Non-goals (this architecture)

- SurrealDB
- Merging Catalog into Inventory
- LLM inside the transactional path
- POS updating quantities directly
