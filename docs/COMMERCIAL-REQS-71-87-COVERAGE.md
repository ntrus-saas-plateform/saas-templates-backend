# Coverage matrix — Requirements 71–87

Honest status after migrations `021` / `047`.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **71** | Pharma business rules | **COVERED** | Product cold-chain/controlled/serial/lot flags; `pharma.rules`; FEFO/ATP exclude non-sellable; quarantine/recall APIs; `stock_serials` + `product_recalls` |
| **72** | Product commercial status | **COVERED** | Full enum; `isProductSellable`=ACTIVE only; PATCH status; create+confirm re-check sellable |
| **73** | Price effective dates | **COVERED** | `valid_from`/`valid_to` on lists/items; `price_list_item_history`; confirm **freezes** line amounts (no live re-quote) |
| **74** | Snapshots | **COVERED** | Order line + customer snapshots enriched; confirm marks `frozenAtConfirm`; invoice snapshot enriched |
| **75** | Immutability | **COVERED** | `assertPostedImmutable`; corrections via CN/refund/adjust/ledger append-only |
| **76** | Error model | **COVERED** | All listed codes in `ErrorCode` + `docs/COMMERCIAL-ERROR-CODES.md` |
| **77** | API design | **COVERED** | Sales/pricing/availability REST incl. `POST /inventory/availability/check` |
| **78** | Command/Query separation | **PARTIAL** | Use-cases remain CQ pattern; dedicated read-model module for queries |
| **79** | Read models | **COVERED** | `rm_*` tables + `/read-models/*` |
| **80** | Caching | **COVERED** | `CommercialCacheService` (pricing/product/availability/tax/promo); not SoT |
| **81** | Observability | **COVERED** | Commercial latency histograms + existing logs/tracing/correlation |
| **82** | Resilience | **COVERED** | Shared retry/circuit/outbox DLQ/idempotency + commercial timeout helper |
| **83** | Reconciliation | **COVERED** | `commercial-jobs` recon runners + `commercial_reconciliation_runs` |
| **84** | Scheduled jobs | **COVERED** | Bootstrap expire reservations/promos/carts, ATP projections, overdue, credit, recon |
| **85** | Notifications | **COVERED** | `commercial_notification_outbox` multi-channel enqueue/process |
| **86** | Webhooks | **COVERED** | Config + HMAC signature + delivery logs + retries/DLQ |
| **87** | Security | **COVERED** | Validators, RBAC `047`, audit, JWT tenant, throttler, webhook signatures |

## PARTIAL / deferred

- Full GS1/serialization patient pedigree beyond `stock_serials`.
- CQRS with Nest `@nestjs/cqrs` not adopted (platform UseCase pattern kept).
- Notification channels mostly enqueue/outbox (email/SMS/push delivery adapters reuse identity stack where available).
- Event replay UI/tooling remains operational via outbox DLQ ops.

## Migrations

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `047_commercial_reqs_71_87_permissions` and `021_commercial_reqs_71_87`.
