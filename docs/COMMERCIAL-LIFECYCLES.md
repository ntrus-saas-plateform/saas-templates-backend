# Commercial Lifecycles

Concise state lists for core commercial documents (reqs 111–112 documentation).

## Order (`SalesOrderStatus`)

`DRAFT` → `PENDING_APPROVAL` (optional) → `CONFIRMED` → `PAYMENT_PENDING` / `PAID` / `PARTIALLY_PAID` → `ALLOCATING` → `ALLOCATED` | `PARTIALLY_ALLOCATED` | `BACKORDERED` → `PICKING` → `FULFILLED` | `PARTIALLY_FULFILLED` → `SHIPPED` | `PARTIALLY_SHIPPED` → `DELIVERED` → `COMPLETED`  
Terminal: `CANCELLED`, `COMPLETED`

## Pricing

Price lists / items: effective via `valid_from` / `valid_to`; inactive when outside window.  
Quote at confirm → **frozen line snapshot** (no live re-quote). Promotions apply at quote time only.

## Reservation

`ACTIVE` → `ALLOCATED` | released (`RESERVATION_RELEASE` / cancelled). Timed out by reservation job using `expires_at` (set on confirm from `commercial_org_config.reservation_timeout_minutes`) or, for legacy NULL expiry rows, `created_at + reservation_timeout_minutes`.

## Allocation

Strategy default `FEFO` (config). Reservation lines → lot picks → `ALLOCATED` / shortfall → `PARTIALLY_ALLOCATED` / `BACKORDERED`. Soft ledger: `ALLOCATION` (not on-hand).

## Fulfillment

Pick / pack / ship / deliver driven from order statuses `PICKING` → `FULFILLED` → `SHIPPED` → `DELIVERED`. Stock leave via `ISSUE` / `SALE` ledger entries.

## Return (`ReturnStatus`)

`REQUESTED` → `AUTHORIZED` → `RECEIVED` → `INSPECTING` → `APPROVED` | `RESTOCKED` | `QUARANTINED` | `DISPOSED` → `REFUNDED` → `CLOSED`  
Also: `REJECTED`, `CANCELLED`

## Payment

Capture / mixed methods → invoice `amount_paid` update. Statuses include captured / refunded paths on `commercial_payments`. Order may move `PAYMENT_PENDING` → `PARTIALLY_PAID` → `PAID`.

## Invoice

Create + post → immutable posted document. Corrections via credit note / debit note / refund — not in-place edit.

## Purchase (`PurchaseOrderStatus`)

`DRAFT` → `APPROVAL` → `SENT` → `ACKNOWLEDGED` → `PARTIALLY_RECEIVED` | `RECEIVED` → `CLOSED`  
Terminal: `CANCELLED`, `CLOSED`. Goods receipt posts inventory `RECEIPT`.
