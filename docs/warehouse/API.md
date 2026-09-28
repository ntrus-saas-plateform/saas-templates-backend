# Warehouse API (Waves 1–2)

Base: `/api/v1/warehouse` — `@RequireModule('inventory')` + `@RequiresCapability('WAREHOUSE')`

| Area | Paths | Permission | Capability |
|------|-------|------------|------------|
| Docks | `POST/GET .../warehouses/:id/docks` | `warehouse:manage` / `read` | INBOUND |
| Dock appointments | `POST .../dock-appointments` | `warehouse:manage` | DOCK_APPOINTMENTS |
| ASN | `POST /asns`, `POST /asns/:id/transition` | `warehouse:receiving_execute` | ASN |
| ASN from PO | `POST /asns/from-purchase-order` | `warehouse:receiving_execute` | ASN |
| Receiving | `POST /asns/:id/receivings`, `accept-line`, `complete` | `warehouse:receiving_execute` | RECEIVING |
| Putaway | `POST /putaway/tasks/:id/complete` | `warehouse:putaway_execute` | PUTAWAY |
| Tasks | `POST /tasks/:id/transition` | `warehouse:tasks_assign` | WAREHOUSE_TASKS |
| Waves | `POST /waves/release` | `warehouse:picking_execute` | WAVE_PICKING |
| Picking | `POST /picking/tasks/:id/complete` | `warehouse:picking_execute` | PICKING |
| Packing / HU | `POST /packing/sessions`, `/handling-units` | `warehouse:packing_execute` | PACKING / HANDLING_UNITS |
| Shipping | `POST /shipments`, `/shipments/:id/dispatch` | `warehouse:shipping_*` | SHIPPING |
| Split plan | `POST /fulfillment/plans` | `warehouse:shipping_create` | SPLIT_SHIPMENT |
| Offline | `POST /offline/sessions`, `/offline/sync` | `warehouse:offline_sync` | OFFLINE_WAREHOUSE |
| Carriers | `POST /carriers`, `/carriers/rates` | `warehouse:carrier_manage` | CARRIER / CARRIER_RATE_SHOPPING |
| Returns | `POST /returns`, `/returns/:id/disposition` | `warehouse:returns_execute` | RETURNS_LOGISTICS |
| Ops center | `GET /ops/center`, `POST /ops/scan-stuck`, incident/discrepancy actions | `warehouse:ops_manage` / `reconciliation_manage` | WAREHOUSE |
| Cold chain | `POST /cold-chain/readings` | `warehouse:cold_chain_manage` | COLD_CHAIN_LOGISTICS |

**Concurrency:** `expectedVersion` on transitions → **409**.  
**Idempotency:** `idempotencyKey` on accept-line → Inventory receiveLot; offline sync key + clientOperationId.
