# Inventory platform hardening — Requirements 58–97

Status after migrations `028_inventory_platform_hardening` + control-plane `051_inventory_fine_permissions`.

| # | Capability | Status | Primary surfaces |
|---|------------|--------|------------------|
| **58** | Filtering + pagination/cursor/sort | **Done** | `GET /inventory/stock` — search/status/product/category/lot/serial/location/warehouse/facility/dates/expiration/qty/stockStatus |
| **59** | Bulk operations | **Done** | `POST /inventory/bulk` — block/quarantine/adjust/expiration (+ transfer/count/import/price types); limits 1000; progress; partial failure; audit |
| **60** | Business error codes | **Done** | `ErrorCode`: INSUFFICIENT_STOCK, LOT_NOT_FOUND, LOT_EXPIRED, LOT_RECALLED, PRODUCT_BLOCKED, LOCATION_INCOMPATIBLE, RESERVATION_EXCEEDS_AVAILABLE, INVALID_STOCK_TRANSITION, TRANSFER_ALREADY_COMPLETED, COUNT_ALREADY_CLOSED, APPROVAL_REQUIRED, QUARANTINE_REQUIRED; no stacks in prod filter |
| **61** | Observability | **Done** | structured logs + correlation/request IDs; inventory metrics; health/ready/live (platform) |
| **62** | Performance | **Done** | set-based list queries; indexes; heavy analytics via jobs |
| **63** | Redis caching | **Done** | product/barcode/availability/alerts namespaces; **Redis never stock SoT** |
| **64** | Security | **Done** | Keycloak/JWT/RBAC; fine perms `051`; tenant/org/warehouse isolation; throttle; anti-IDOR; audit |
| **75** | Async jobs | **Done** | expiration, alerts, dormant analytics, temperature, ATP, outbox/notifications |
| **76** | Scheduler | **Done** | every:300s / 900s / 3600s + policy `job_schedules` JSON (configurable) |
| **77** | Notifications | **Done** | events only: LowStock/Expiration/Recall/Temperature/ApprovalRequired — no provider coupling |
| **78** | Future AI ports | **Done** | Copilot + DemandForecasting/Stockout/Expiration/Anomaly/Replenishment/Slotting port interfaces; no LLM in TX |
| **79** | Inventory Copilot tools | **Done** | `GET /inventory/copilot/*` — getStockPosition, lot/product traceability, expiring, stockout risks, dormant, anomalies |
| **80** | 3D warehouse | **Done** | `GET /inventory/locations/3d`, `…/:id/occupancy`; gated by `3dWarehouse` flag |
| **SM** | State machines | **Done** | receipts, transfers, reservations, counts, quarantines, recalls, disposals, workflows in `state-machines.ts` + wms/serial |
| **89** | Domain policies | **Done** | allowNegativeStock, requireLot/ExpirationForMedication, approvals, FEFO, quarantineReturns, partial receive/transfer, … |
| **90** | Versioned inventory config | **Done** | `inventory_policies.version` + feature_flags/retention/job_schedules |
| **91** | Feature flags | **Done** | serialTracking, coldChain, advancedAllocation, forecasting, 3dWarehouse, aiRecommendations |
| **92** | Soft delete | **Done** | `deleted_at` on products/SKUs/warehouses/zones/locations/facilities; ledger never deleted |
| **93** | Data retention | **Done** | `retention` JSON on policies (ledger/audit/events/readings/documents days) |
| **94** | Privacy | **Done** | ledger/movements use `referenceType`/`referenceId` |
| **95** | Accounting integration | **Done** | `inventory_accounting_intents` + outbox `inventory.accounting.intent.v1` (no GL in Inventory) |
| **96** | Purchasing integration | **Done** | GR → receive; goods received events; replenishment suggestions |
| **97** | Sales / POS integration | **Done** | Reserve/Allocate/Release/CommitIssue via InventoryEngine; POS → Sales only |

## Migrations

- `migrations/tenant/028_inventory_platform_hardening.sql`
- `migrations/control-plane/051_inventory_fine_permissions.sql`

## Key APIs

- `GET /inventory/stock`
- `POST /inventory/bulk` · `GET /inventory/bulk/:id`
- `GET /inventory/locations/3d` · `GET /inventory/locations/:id/occupancy`
- `GET /inventory/copilot/stock-position|lot-traceability|expiring|stockout-risks|dormant|anomalies`
- `GET/PUT /inventory/policies` (config + flags)
