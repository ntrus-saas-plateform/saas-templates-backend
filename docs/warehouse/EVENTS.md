# Warehouse Events (Waves 1–2)

Registered in `event-catalog.ts`. Mutations use transactional outbox + `commercialEvent`.

| Event | When |
|-------|------|
| `warehouse.asn.created.v1` | ASN created |
| `warehouse.asn.received.v1` | ASN marked received |
| `warehouse.receiving.started.v1` | Receiving opened from ASN |
| `warehouse.receiving.completed.v1` | Receiving completed / partial / rejected |
| `warehouse.receiving.variance_detected.v1` | Shortage / overage / damage |
| `warehouse.putaway.task_created.v1` | Putaway after inventory receipt |
| `warehouse.putaway.completed.v1` | Putaway completed |
| `warehouse.wave.released.v1` | Wave released |
| `warehouse.picking.completed.v1` | Pick completed |
| `warehouse.picking.short_pick.v1` | Short pick flagged |
| `warehouse.packing.started.v1` | Packing session started |
| `warehouse.shipment.created.v1` | Shipment created (pre-issue) |
| `warehouse.shipment.dispatched.v1` | Dispatch after Inventory issue |
| `warehouse.offline.operation_applied.v1` | Offline op applied |
| `warehouse.carrier.rates_shopped.v1` | Rate quotes saved |
| `warehouse.return.authorized.v1` | Return shipment created |
| `warehouse.return.dispositioned.v1` | Return dispositioned |
| `warehouse.reconciliation.discrepancies_detected.v1` | Stuck-task scan |
| `warehouse.ops.incident_updated.v1` | Ops incident action |
| `warehouse.cold_chain.excursion_detected.v1` | Temperature excursion |

Stock events remain `inventory.stock.*` / `fulfillment.*`.
