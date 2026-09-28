# Commercial Sequences

Mermaid sequence diagrams for primary commercial flows.

## Create Order

```mermaid
sequenceDiagram
  actor User
  participant Sales
  participant Catalog
  participant DB
  User->>Sales: POST /sales/orders
  Sales->>Catalog: Validate SKUs sellable
  Sales->>DB: Insert sales_orders + lines (DRAFT)
  Sales-->>User: Order DRAFT
```

## Confirm Order

```mermaid
sequenceDiagram
  actor User
  participant Sales
  participant Pricing
  participant Inventory
  participant Outbox
  User->>Sales: POST .../confirm
  Sales->>Pricing: Quote lines (freeze snapshots)
  Sales->>Inventory: checkAvailability (ATP)
  Sales->>Inventory: reserve (per line)
  Note over Sales,Inventory: Reserve may run outside order TX (PARTIAL)
  Sales->>Outbox: TX: transition CONFIRMED + outbox + audit
  Sales-->>User: Order CONFIRMED
```

## Reserve

```mermaid
sequenceDiagram
  actor Caller
  participant Inventory
  participant DB
  Caller->>Inventory: reserve(sku, wh, qty, order)
  Inventory->>DB: Insert inventory_reservations ACTIVE
  Inventory->>DB: Ledger RESERVATION (soft)
  Inventory-->>Caller: Reservation
```

## Allocate FEFO

```mermaid
sequenceDiagram
  actor User
  participant Inventory
  participant DB
  User->>Inventory: allocate order (FEFO)
  Inventory->>DB: Load sellable lots expires_at ASC
  Inventory->>DB: Insert allocations + ALLOCATION ledger
  Inventory-->>User: picks / shortfalls
```

## Fulfill

```mermaid
sequenceDiagram
  actor User
  participant Fulfillment
  participant Inventory
  participant Sales
  User->>Fulfillment: pick / ship
  Fulfillment->>Inventory: commitIssue (ISSUE/SALE)
  Fulfillment->>Sales: status PICKING → FULFILLED → SHIPPED
```

## Complete Sale

```mermaid
sequenceDiagram
  actor User
  participant Sales
  participant Finance
  User->>Finance: Create + post invoice
  User->>Finance: Capture payment
  Finance->>Sales: PAID / COMPLETED path
  Sales-->>User: COMPLETED
```

## Return

```mermaid
sequenceDiagram
  actor User
  participant Returns
  participant Inventory
  participant Finance
  User->>Returns: REQUESTED → AUTHORIZED → RECEIVED
  Returns->>Returns: INSPECTING → RESTOCKED|QUARANTINED|DISPOSED
  Returns->>Inventory: RETURN / quality move
  Returns->>Finance: Credit note / refund
  Returns-->>User: CLOSED
```

## Create PO

```mermaid
sequenceDiagram
  actor User
  participant Purchasing
  participant DB
  User->>Purchasing: Create PR / PO DRAFT
  Purchasing->>DB: APPROVAL → SENT
  Purchasing-->>User: PO SENT
```

## Receive Goods

```mermaid
sequenceDiagram
  actor User
  participant Purchasing
  participant Inventory
  User->>Purchasing: Receive against PO
  Purchasing->>Inventory: receiveLot (RECEIPT)
  Purchasing->>Purchasing: PARTIALLY_RECEIVED | RECEIVED
```

## Process Payment

```mermaid
sequenceDiagram
  actor User
  participant Finance
  participant Sales
  User->>Finance: POST /finance/payments (capture)
  Finance->>Finance: Update invoice amount_paid
  Finance->>Sales: Order payment status
  Finance-->>User: Payment captured
```
