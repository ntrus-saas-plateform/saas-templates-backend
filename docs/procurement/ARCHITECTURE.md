# Procurement Architecture — Wave 1

## Bounded context

**Owns:** Supplier master, catalog mappings, contracts/prices (+ history), purchase requisitions, RFQ / quotations / award decisions, purchase orders, goods receipts coordination, backorders, supplier invoice **documents**, supplier credits, landed-cost documents, three-way match persistence.

**Does not own:** Stock balances / inventory ledger, AP GL / payment runs, customers, sales orders.

## Module

Extends existing Nest module [`src/modules/purchasing`](../../src/modules/purchasing) — no second authorization, outbox, or inventory engine.

```
presentation/ → application/ → domain/ (+ ports) → infrastructure/
```

## Critical invariant: PO ≠ stock

Creating, approving, or transitioning a purchase order **never** calls `InventoryRepositoryPort.receiveLot`.

Stock increases only after goods receipt validation:

`PurchaseOrder → GoodsReceipt (accepted qty) → Inventory receiveLot → Ledger`

Proof: `po-does-not-touch-stock.spec.ts`.

## Multi-vertical

Same engine for Pharmacy / Supermarket / Restaurant / Boutique / Wholesale.

Differentiation via **BusinessContext** `enabledCapabilities` + policies — never `if (businessType === 'PHARMACY')` in procurement core.

Extra capabilities (seeded in tenant `042`): `SUPPLIER_MANAGEMENT`, `RFQ`, `SUPPLIER_QUOTATION`, `THREE_WAY_MATCH`, `LANDED_COST`, `SUPPLIER_RETURNS` (all depend on `PURCHASING`).

## Accounting boundary

`supplier_invoices` / `supplier_credits` are **procurement documents** for three-way match SoT.

They are **not** an AP ledger. Wave 2 may consume `purchasing.supplier_invoice.posted.v1` / match events for GL.

## Reuse

| Concern | Source |
|---------|--------|
| Outbox | `OutboxTransactionService` + `commercialEvent` |
| Idempotency | Global `Idempotency-Key` interceptor |
| Concurrency | `expectedVersion` → `ErrorCode.CONFLICT` → HTTP 409 |
| Audit | `@AuditAction` |
| AuthZ | `@RequireModule('purchasing')` + `@RequirePermissions` + `@RequiresCapability` |
| 3-way evaluator | `orchestration/domain/three-way-match.ts` (pure) |
| Returns inventory | `returns` module / supplier credit doc link |

## Migrations

- Tenant: `042_procurement_engine_v1.sql`
- Control-plane: `059_procurement_permissions.sql`
