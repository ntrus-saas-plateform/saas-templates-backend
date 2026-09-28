# ERP Integration Contracts

TypeScript-only versioned contracts in `src/modules/orchestration/domain/contracts.ts`. They describe the **payload shape** for cross-domain calls. Implementations live behind adapter interfaces in `adapters.ts`.

| Contract | Version | Purpose | Owning domain |
|----------|---------|---------|---------------|
| `InventoryAvailabilityContract` | 1.0 | ATP / CanSell check | Inventory |
| `InventoryReservationContract` | 1.0 | Soft reservation | Inventory |
| `InventoryAllocationContract` | 1.0 | FEFO allocation | Inventory |
| `PaymentCaptureContract` | 1.0 | Capture payment against invoice | Finance |
| `AccountingPostingContract` | 1.0 | Journal posting request | Accounting / finance |
| `ShipmentCreationContract` | 1.0 | Create shipment | Fulfillment / WMS |
| `PurchaseReceiptContract` | 1.0 | Post GR against PO | Purchasing / Inventory |

## Adapter interfaces

- `InventoryAdapter` — checkAvailability, reserve, allocate, releaseReservationsForOrder
- `AccountingAdapter` — post
- `PaymentAdapter` — capture
- `WarehouseAdapter` — createShipment, postGoodsReceipt

**Current wiring:** `SalesOrderSagaOrchestrator` optionally injects `InventoryEngineService` (exported by `InventoryModule`) for ATP/RESERVE/compensation. Other adapters are contracts only — steps record `WAITING` until facades exist.

## Rules

1. Contracts do not grant write access to foreign schemas.
2. Contract `contractVersion` is independent of integration event catalog versions.
3. Correlation ID must flow on every call for saga tracing.
