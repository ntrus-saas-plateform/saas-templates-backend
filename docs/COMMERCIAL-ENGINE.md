# Commercial Engine (Tranche 1)

Vertical slice: **Catalog → Inventory → Pricing → Sales → Fulfillment → Finance**.

Stock mutations happen **only** through Inventory ports. Sales never writes lot quantities.

## Order lifecycle

```
DRAFT → CONFIRMED → ALLOCATING → ALLOCATED|PARTIALLY_ALLOCATED|BACKORDERED
  → PICKING → FULFILLED|PARTIALLY_FULFILLED
  → SHIPPED|PARTIALLY_SHIPPED → DELIVERED → COMPLETED
```

Non-terminal states may cancel to `CANCELLED` where the state machine allows. Invalid transitions raise `INVALID_STATE_TRANSITION`.

**Confirm** (`POST /sales/orders/:id/confirm`):

1. Re-quote lines via PricingEngine  
2. Credit check (`credit_limit` / `credit_used` / `credit_hold`)  
3. ATP check via Inventory  
4. Reserve stock (Inventory)  
5. Transition to `CONFIRMED` + outbox `sales.order.confirmed.v1`

## Reservation → allocation

- **Reserve**: ATP check, FEFO-biased lot reserve increments, `inventory_reservations` + ledger `RESERVATION`.  
- **Allocate**: FEFO over active reservations (`expires_at ASC`), skip non-sellable lots, ledger `ALLOCATION`.  
- **Release**: reverse reserved/allocated, ledger `RESERVATION_RELEASE`.

ATP = sellable on-hand − reserved − allocated (sellable = `AVAILABLE` quality, not expired).

## Fulfillment

1. `CreatePickTicket` from allocated order → order `PICKING`  
2. `CompletePick` → pick lines + order `FULFILLED` + `fulfillment.picking.completed.v1`  
3. `CreateShipment` → Inventory `commitIssue` (ledger `ISSUE`) → order `SHIPPED` + `fulfillment.shipment.created.v1`  
4. `MarkDelivered` → order `DELIVERED`

## Invoice / payment

1. `CreateAndPostInvoice` from shipped/delivered order → immutable `POSTED` invoice  
2. Outbox `finance.invoice.issued.v1` + `accounting.ar.entry.requested.v1`  
3. `CapturePayment` allocates to invoice, updates `amount_paid`  
4. Outbox `finance.payment.received.v1` + `accounting.ar.settlement.requested.v1`

Document sequences: `SO`, `QT`, `PICK`, `SHP`, `INV`, `PAY` via `DocumentSequenceService`.

## Modules

| Module | Gate | Key routes |
|--------|------|------------|
| catalog | `catalog` | `/catalog/products` |
| inventory | `inventory` | `/inventory/receive`, `/availability`, `/reserve`, `/allocate` |
| pricing | `pricing` | `/pricing/price-lists`, `/tax-rules`, `/quote` |
| sales | `sales` | `/sales/orders`, `/carts`, `/quotations` |
| fulfillment | `fulfillment` | `/fulfillment/pick-tickets`, `/shipments` |
| finance-commercial | `sales` (Tranche 1) | `/finance/invoices`, `/finance/payments` |
