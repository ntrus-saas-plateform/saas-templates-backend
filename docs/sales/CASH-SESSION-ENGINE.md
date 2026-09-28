# Cash & Sales Session Engine

Enterprise POS register session lifecycle. Sales orchestrates commerce; **cash ledger is SoT for drawer**; Accounting receives `pos.sales_session.accounting_close.v1` on lock; Inventory remains SoT for stock.

## Lifecycle

```text
OPENING → OPEN ⇄ SUSPENDED → CLOSING → PENDING_RECONCILIATION → RECONCILED
  → CLOSED | CLOSED_WITH_VARIANCE → LOCKED
OPENING|OPEN|SUSPENDED → CANCELLED (no sales yet)
```

## HTTP (module `pos`)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/pos/sessions/operators/assign` | `cash-session:assign` |
| POST | `/pos/sessions` | `cash-session:open` |
| POST | `/pos/sessions/:id/confirm-opening` | `cash-session:open` |
| POST | `/pos/sessions/:id/movements` | `cash-session:movement` |
| POST | `/pos/sessions/:id/refunds` | `cash-session:operate` — refund + bind to OPEN session |
| POST | `/pos/sessions/:id/begin-closing` | `cash-session:close` |
| POST | `/pos/sessions/:id/submit-count` | `cash-session:close` |
| POST | `/pos/sessions/:id/approve-variance` | `cash-session:approve_variance` |
| POST | `/pos/sessions/:id/finalize-close` | `cash-session:close` |
| POST | `/pos/sessions/:id/lock` | `cash-session:lock` |
| POST | `/pos/checkout` | `pos:checkout` — **requires `sessionId` in OPEN**; allocate+commit inventory |
| POST | `/finance/payments/refund` | optional `sessionId` → RequireOpen + BindRefund |

## Migrations

- Tenant: `061_cash_session_engine_v1.sql`
- Control-plane: `067_cash_session_permissions.sql`

## Expected cash

```text
expected = openingFloat + Σ(amount_signed) excluding OPENING_FLOAT double-count
```

Client-supplied sales totals are **not** trusted for reconciliation.

## Deprecation

Orchestration `CreatePosShiftCloseUseCase` / `ClosePosShiftUseCase` now throw `FORBIDDEN` and redirect callers to `POST /pos/sessions`.

## Omnichannel handoff

`HandoffSalesOrderUseCase` enqueues `sales.order.handoff.v1` when `fulfillWarehouseId` is set.
`SalesOrderHandoffWarehouseHandler` (EXTRA_INTEGRATION_EVENT_HANDLERS) inbox-dedupes and calls
`ReleaseWarehouseWaveUseCase` — Sales never imports WarehouseModule (avoids Nest circular DI).
