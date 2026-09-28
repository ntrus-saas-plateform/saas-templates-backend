# ERP Orchestration — Coverage vs Master Prompt (reqs 1–39)

PostgreSQL DB-per-tenant only (SurrealDB unused).

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1–2 | Domain separation / no God Module | **Done** | Orchestration owns only `orchestration_*` tables |
| 3 | SoT table | **Done** | Docs + sales never `UPDATE stock_lots` |
| 4 | Sync / events / outbox / inbox / recon | **Done** | Confirm→reserve; commercialEvent; outbox+inbox; three-way + jobs |
| 5 | Command / Event / Query | **Partial** | Use-cases + HTTP verbs; no formal bus |
| 6 | Orchestration vs choreography | **Done** | Sagas + event handlers (analytics-style choreography remains domain) |
| 7 | Saga framework + 6 types | **Done** | 8 types; required fields on `orchestration_sagas` |
| 8 | SalesOrderSaga steps | **Partial** | Steps+timeouts+compensation; PRICE/CREDIT auto when confirm payload present; ALLOCATE+ still WAITING without domain advance |
| 9 | ATP policies | **Done** | `insufficient-stock.policy` + ConfirmSalesOrder + saga ATP |
| 10 | InventoryReserved explicit result | **Done** | Event payload + confirm `reservations[]` |
| 11 | Allocation FEFO | **Done** | Inventory allocator |
| 12 | Fulfillment saga + events | **Done** | `FulfillmentSagaOrchestrator` + event handler |
| 13 | Reservation ≠ issue | **Done** | qty_reserved vs on_hand |
| 14 | Sales never updates stock | **Done** | InventoryEngine only |
| 15–16 | Accounting integration | **Partial** | Intent events; AccountingAdapter interface |
| 17–18 | Payment/order/invoice statuses | **Done** | Independent entities |
| 19–20 | PO ≠ receipt | **Done** | Purchasing receive path |
| 21–22 | Three-way match | **Done** | qty/price/tax/supplier/product variances |
| 23–25 | POS same engines + offline | **Done** | PosCheckout + offline idempotency |
| 26–27 | Global idempotency | **Done** | IdempotencyStore + domain keys |
| 28–29 | correlationId / causationId | **Done** | IntegrationEvent + commercialEvent |
| 30–31 | Event envelope / versioning | **Done** | Envelope fields + `.vN` catalog (no upcaster tooling) |
| 32–33 | Outbox / Inbox atomic | **Done** | Shared messaging |
| 34–36 | Retries / DLQ / replay | **Done** | listDeadLetter + POST `/orchestration/outbox/:id/replay` |
| 37 | Compensation | **Partial** | Inventory release + saga plan; other domains bookkeeping |
| 38 | Payment failure policy | **Done** | `ApplyPaymentFailurePolicyUseCase` + API |
| 39 | InventoryPostingPending | **Done** | `inventory_posting_pending` + event on issue failure |

## Migrations

- `029_orchestration_engine.sql`
- `030_inventory_posting_pending.sql`
- `052_orchestration_permissions.sql`

## Key APIs

`/orchestration/sagas`, `/business-processes`, `/purchasing/three-way-match`, `/pos/shift-close`, `/interventions`, `/integrations/health`, `/ops/dead-letters`, `/outbox/:id/replay`, `/policies/payment-failure`
