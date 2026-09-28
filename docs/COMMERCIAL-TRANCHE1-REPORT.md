# Commercial Engine — Tranche 1 delivery report

## Architecture

| Module | Created |
|--------|---------|
| `catalog` | Product / SKU / barcode |
| `inventory` | Ledger, lots, ATP, reserve, FEFO allocate, issue |
| `pricing` | Price lists, tax rules, quote engine |
| `sales` | Cart, quotation, order state machine |
| `fulfillment` | Pick tickets, shipments |
| `finance-commercial` | Invoices, payments, AR outbox events |
| `commercial-shared` | Document sequences, execution context, events |

**Modified:** `AppModule`, customer credit/types, `ErrorCode`, `event-catalog`, RBAC `041`, customer profile `042`, settings `MODULE_KEYS`, Swagger tags.

## Database

- Tenant: [`migrations/tenant/016_commercial_core.sql`](../migrations/tenant/016_commercial_core.sql)
- Control-plane: `041_commercial_permissions.sql`, `042_customer_commercial_profile.sql`

## API (selected)

- `POST/GET /api/v1/catalog/products`
- `POST /api/v1/inventory/receive|reserve|allocate`, `GET .../availability`
- `POST /api/v1/pricing/price-lists`, `/tax-rules`, `/quote`
- `POST /api/v1/sales/orders`, `.../confirm`, `.../allocate`, carts, quotations
- `POST /api/v1/fulfillment/pick-tickets`, `.../complete`, `/shipments`, `.../deliver`
- `POST /api/v1/finance/invoices`, `/finance/payments`
- `PATCH /api/v1/customers/:id/commercial`

## Tests

22 unit tests green (FEFO, ATP, state machine, pricing, confirm/credit, concurrency last-unit, vertical-slice orchestration).

## Gaps (honest)

See [COMMERCIAL-ARCHITECTURE.md](./COMMERCIAL-ARCHITECTURE.md) — CTP avancé, purchasing, returns, loyalty, GL, dashboards, FE rewire, single TX confirm+reserve still **MISSING/PARTIAL/FUTURE**.
