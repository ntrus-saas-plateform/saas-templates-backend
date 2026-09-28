# Coverage matrix — Requirements 47–70

Honest status after migrations `020` / `046` and new modules wired in `AppModule`.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **47** | Sales commissions | **COVERED** | `src/modules/commissions` — agents, rules (NET_SALES / COLLECTED_REVENUE / …), periods, accrue/approve; `computeCommission` engine + tests |
| **48** | Contracts | **COVERED** | `src/modules/contracts` — CUSTOMER/SUPPLIER/PRICE/VOLUME/SERVICE/DISTRIBUTION; dates, pricing/volume/SLA/clauses JSON; SM + approve/activate; supplier shell in purchasing still valid |
| **49** | Loyalty | **COVERED** | `src/modules/loyalty` — tiers, accounts, rewards, earn/redeem/expire; **no Sales imports** (reference ids only) |
| **50** | Gift vouchers | **COVERED** | `src/modules/vouchers` — issue/activate/redeem/cancel + ledger audit; hashed codes |
| **51** | Workflow engine | **COVERED** | `src/modules/workflow` — definitions + instances; threshold examples (amount / discount / credit) |
| **52** | Approval engine | **COVERED** | Sequential/parallel/threshold/role/amount/customer/product modes in `approval-engine.ts` |
| **53** | Business rules | **COVERED** | `src/modules/rules` — policy types PRICING…BACKORDER; versioned publish + evaluate |
| **54** | Inventory integration | **COVERED** | Sales/fulfillment/returns/purchasing still mutate stock **only** via Inventory ports |
| **55** | Inventory ledger | **COVERED** | Transfer/adjust + reconstruct on-hand; shipment issue ledger uses `SALE`; types include RECEIPT/RETURN/TRANSFER_*/ADJUSTMENT/… |
| **56** | Domain events | **COVERED** | Catalog extended (commission/contract/loyalty/voucher/workflow/policy/bulk/import/inventory transfer) |
| **57** | Outbox | **COVERED** | Critical writes in new modules use `OutboxTransactionService` where applicable |
| **58** | Idempotency | **PARTIAL** | Global `Idempotency-Key` interceptor + voucher redeem optional key; not mandatory on every critical POST |
| **59** | Concurrency | **COVERED** | Inventory `FOR UPDATE` + ATP unchanged; transfers lock lots |
| **60** | Tenant isolation | **COVERED** | JWT `TenantContext` only — no body `tenantId` |
| **61** | RBAC | **COVERED** | CP `046` seeds commissions/contracts/loyalty/vouchers/workflow/policies/search/reports/… + finer sales/pricing/orders keys |
| **62** | Audit trail | **COVERED** | `@AuditAction` on mutating routes of new modules |
| **63** | Document numbering | **COVERED** | Sequences COM/CTR/GV/TRF/WF; concurrency-safe `UPDATE … RETURNING` |
| **64** | Global search | **COVERED** | `GET /commercial/search` + view `v_commercial_search_documents` / UNION repo |
| **65** | Filtering | **COVERED** | `GET /sales/orders` paginated filters; search limit/offset; report date ranges |
| **66** | Bulk ops | **COVERED** | `commercial-ops` bulk jobs with dry-run / partial failure / audit payload |
| **67** | Import/export | **PARTIAL** | Pipeline statuses UPLOAD→…→IMPORT on `commercial_import_batches`; staging-first (does not dump into final tables) |
| **68** | Reporting | **COVERED** | `/reports` sales aggregations (day/product/customer/channel) |
| **69** | Dashboards | **COVERED** | Projection table + refresh/list for SALES/INVENTORY/PURCHASING/CUSTOMER/PROFITABILITY |
| **70** | Analytics | **COVERED** | KPI catalog + snapshot compute/list endpoints |

## PARTIAL / deferred (honest)

- Full parallel multi-approver graphs / SLA escalation UX beyond engine primitives.
- Import pipeline does not yet materialize all entity types into master tables (staging + report first).
- Idempotency not enforced as hard requirement on every money/stock POST (header opt-in).
- Real-time push (WS) for dashboards — poll/projections only.
- Loyalty earn is API/event-driven; no automatic Sales outbox consumer wired yet (by design decoupling).

## Migrations

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `046_commercial_reqs_47_70_permissions` and `020_commercial_reqs_47_70`.
