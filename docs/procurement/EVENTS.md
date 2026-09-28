# Procurement Events (Wave 1)

All registered in `src/core/domain/events/event-catalog.ts`. Produced via transactional outbox.

| Event | When |
|-------|------|
| `purchasing.requisition.created.v1` | PR created |
| `purchasing.requisition.rejected.v1` | PR rejected |
| `purchasing.po.created.v1` | PO created |
| `purchasing.po.approved.v1` | PO approved (legacy emit on transition) |
| `purchasing.po.transitioned.v1` | Any PO status transition |
| `purchasing.po.backorder_registered.v1` | Backorder registered |
| `purchasing.goods_receipt.posted.v1` | GRN posted (+ inventory receive) |
| `purchasing.supplier.status_changed.v1` | Supplier lifecycle transition |
| `purchasing.rfq.created.v1` | RFQ created |
| `purchasing.rfq.opened.v1` | RFQ opened |
| `purchasing.rfq.suppliers_invited.v1` | Invitations sent |
| `purchasing.rfq.awarded.v1` | Award / selection decision (no auto-PO) |
| `purchasing.quotation.submitted.v1` | Quotation submitted |
| `purchasing.supplier_invoice.created.v1` | Invoice document created |
| `purchasing.supplier_invoice.posted.v1` | Invoice posted (procurement SoT) |
| `purchasing.three_way.matched.v1` | Match status MATCHED / partial success path |
| `purchasing.three_way.failed.v1` | Mismatch / blocked |
| `purchasing.landed_cost.created.v1` | Landed cost doc created |
| `purchasing.landed_cost.allocated.v1` | Allocations written |
| `purchasing.supplier_credit.created.v1` | Supplier credit document |

## Consumers

Wave 1 does not require dedicated inbox handlers. Inventory is updated synchronously in `ReceiveGoodsUseCase` within the same outbox transaction as GRN persist.
