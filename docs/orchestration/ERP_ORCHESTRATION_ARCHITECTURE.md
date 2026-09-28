# ERP Orchestration Architecture

## Role

Orchestration **coordinates** cross-domain business processes. It does **not** own commercial SoT (stock, orders, invoices, payments). Domains remain authoritative; orchestration persists saga/process state only in its own tables (`orchestration_*`, `business_processes`, `purchasing_three_way_matches`, `pos_shift_closes`).

## Source of truth

| Concern | Owner (SoT) | Orchestration |
|--------|-------------|---------------|
| Sales order / lines | Sales | Saga correlation + steps |
| Stock / ATP / reservation / allocation | Inventory | Calls `InventoryEngineService` when available |
| Pricing / credit | Pricing / Finance | Step WAITING until facade wired |
| Fulfillment / shipment | Fulfillment | Contract + WAITING |
| Invoice / payment | Finance commercial | Contract + WAITING |
| Accounting journals | Accounting / finance intents | `AccountingPostingContract` |
| PO / GR / AP | Purchasing | Three-way match records only |
| POS cash | POS | Shift-close expected/actual variance |

## Patterns

- **Saga / process manager** — defined steps per `SagaType`; advance via API or thin orchestrators.
- **Compensation** — reverse order of compensatable completed steps (`buildCompensationPlan`).
- **Outbox** — saga lifecycle events (`orchestration.saga.*.v1`) via `OutboxTransactionService` + `commercialEvent` (supports `causationId`).
- **Inbox** — domain consumers stay in MessagingModule; orchestration handler for `sales.order.confirmed.v1` is **not** auto-registered (fixed handler list).
- **No cross-domain DB mutation** — repository only touches orchestration/tenant tables listed above; inventory mutations go through `InventoryEngineService`.

## Nest layout

Mirrors inventory/workflow modules:

- `domain/` — types, definitions, engine, contracts, adapters, repository port
- `application/` — use-cases + `SalesOrderSagaOrchestrator`
- `infrastructure/` — PG repository, providers, optional event handler
- `presentation/` — `OrchestrationController` under `/orchestration`

## Permissions

`orchestration:read|manage|ops|shift_close`, `purchasing:three_way` (control-plane migration `052_orchestration_permissions.sql`).
