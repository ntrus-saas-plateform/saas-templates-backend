# Commerce sections 26–79 — evidence report

**Date:** 2026-09-24  
**Rule:** P0 declaration, P1 structure, P2 runtime, P3 automated tests, P4 adversarial, P5 production.  
**PRODUCTION READY = NO.** A local scratch-database drill is recorded. Certification on live tenants is still blocked (section 78) for financial, stock, session, MCP, and offline paths.

## 1. Executive summary

Four commerce profiles compose one Core (Sales, POS, Catalog, Pricing, Inventory, Procurement, Warehouse, CRM). Cosmetics and books are product extensions. Lot, batch, expiration, FEFO, quarantine, and recall stay Core Inventory. There is no second sales, POS, inventory, pricing, customer, payment, return, or warehouse engine.

What is verified at P3 is the capability composition, dependency refusal, price-list chain, bookstore/cosmetics MCP permission gates, POS stock compensation, returns→WMS bridge, and import commit for products, prices, and customers in one transaction per batch. A local drill on `DESKTOP-7VLQLDO` is recorded in `P5-LIVE-DRILL.json`. Frontend screens are not certified, and that drill is not a production SLO.

## 2–4. Repository, existing implementation, components

| Area | Where | Level |
|------|--------|-------|
| Profiles + capabilities | `commerce-capability.catalog.ts`, migrations `066`–`068` | P3 |
| BusinessContext freeze + hierarchy | `business-config.use-cases.ts`, `config-resolution.ts` | P3 |
| Book extension + ISBN | `book-isbn.ts`, `CreateBookProductUseCase` | P3 |
| Cosmetic extension | `cosmetic.attributes` schema v2, `CreateCosmeticProductUseCase` | P2–P3 |
| Pricing + promotions | `PricingEngine`, `promotion.engine.ts`, `price-resolution.ts` | P3 |
| Inventory FEFO / recalled lots | `fefo.allocator.ts` | P3 (pharmacy + inventory) |
| POS checkout compensation | `PosCheckoutUseCase` | P3 |
| Returns + WMS | `returns-wms-bridge.ts` | P3 |
| MCP bookstore/cosmetics/commerce | `mcp-tools.service.ts`, `mcp-action-class.ts` | P4 unit (permission, capability, EXECUTE confirm) |
| Offline POS replay | `offline-admission.ts`, `SyncOfflineOperationUseCase` | P3 unit (live config version, POS, pos:sync, open session) |
| Cash sessions | cash-session use cases | P2–P3 (existing) |

## 5. Business profiles

| Profile | Composition | Level |
|---------|-------------|-------|
| GENERAL_COMMERCE | Core commerce facets, no book/cosmetics markers | P3 |
| RETAIL_STORE | GENERAL_COMMERCE + store / register / click-and-collect | P3 |
| STATIONERY_BOOKSTORE | RETAIL_STORE + ISBN/book/stationery + B2B pricing | P3 |
| COSMETICS_RETAIL | RETAIL_STORE + cosmetic extension facets + LOT/BATCH/EXPIRATION/FEFO/QUARANTINE/RECALL | P3 |
| PHARMACY | Unchanged Core + clinical caps | P3 unit suite re-run (not a live tenant drill) |

## 6–8. Capabilities, policies, workflows

Cosmetic facets (`068`): `COSMETIC_BRAND`, `COSMETIC_CATEGORY`, `SHADE_MANAGEMENT`, `COLOR_MANAGEMENT`, `SIZE_MANAGEMENT`, `FRAGRANCE_MANAGEMENT`, `COSMETIC_ATTRIBUTES`. `BATCH_TRACKING` depends on `LOT_TRACKING`. `EXPIRATION_TRACKING` depends on `EXPIRATION`. `COSMETIC_VARIANTS` is **AVAILABLE** (`069`): shade/size/color axes materialize Core SKUs.

Store policies live on `policyBundle.store`. Cosmetics policy sets `blockExpiredSale`, `blockRecalledSale`, `enableFefo`. Expired and recalled lots are rejected by the Core FEFO allocator (`LOT_EXPIRED` / `LOT_RECALLED`), not by a cosmetics-specific stock engine.

Workflows stay the existing sales, POS, and cash-session bindings. No new workflow engine.

## 9–11. Domain, application, API

Product remains the aggregate. `CosmeticExtension` is `cosmetic.attributes` (brand, category enum, shade, color, finish, fragrance, size, ingredients, packaging, and an open `regulatory` object — no jurisdiction invented). Batch and expiry stay on inventory lots.

Actions `CreateCosmeticProduct` / `UpdateCosmeticProduct` delegate to catalog use cases. Shade/color/fragrance/size are fields of that extension. Batch quarantine, recall, price, and promotion actions delegate to inventory and pricing use cases.

HTTP auth, tenant, and org guards are the existing platform filters. This pass did not re-audit every route for pagination and rate limits.

## 12. Frontend

**NOT VERIFIED.** No capability-driven UI for stores, books, stationery categories, or cosmetics batches was added in this pass. Business logic must not use `if (businessType === ...)`.

## 13. MCP

Bookstore, cosmetics, commerce, and boutique tools that exist go through permission, then capability, then EXECUTE confirmation. Permission and capability refusals increment `mcp_denied_total`. `bookstore.search_author`, `search_publisher`, `get_book_inventory`, `get_book_price`, `cosmetics.get_batch`, `get_expiration`, `get_available_stock`, `get_price`, and `search_brands` delegate to Core catalog, pricing, or inventory. The local drill opened a TCP listener and posted to `/mcp/tools/call`, which called `McpToolsService.invoke` directly. Missing `catalog:fashion.manage` returned 403 `FORBIDDEN`. An unconfirmed `boutique.create_collection` returned 422 `VALIDATION_ERROR`. The same call with `confirmed: true` returned 200 and stored `MCP1` as `DRAFT`. That path does not pass through the Nest JWT filter.

## 14–16. Events, outbox, idempotency

Transactional outbox is the existing `OutboxTransactionService` (publish after local commit). Commercial events include return bridge events. Idempotency keys exist on payments and offline operations. Not every new facet mutation emits a dedicated event such as `BatchQuarantined` from the cosmetics API (those events belong to inventory/pharmacy recall flows).

## 17–20. Concurrency, offline, security, isolation

Optimistic versions exist on orders, returns, and cash sessions. ISBN uniqueness is org-scoped (`product_isbn_index`). Offline sync is the existing POS offline queue; this pass did not add the full server checklist in section 38 as a single gate. Redis business-context keys are `tenant:organization:version`. On Redis DB 15 the drill stored a store-a fashion key, read null for the store-b key, and `assertCacheKeyScope` rejected the store-a key when the caller was store-b. Two Postgres sessions on `fashion_collections` both read version 1; one update wrote 1 row and the other wrote 0. The stored row was `PLANNED` version 2, and a repository call with `expectedVersion` 1 returned `CONFLICT`.

Named domain errors (`commerce-errors.ts`): capability, entitlement, price, promotion, stock, reservation, session, return, refund, ISBN, expired batch, recalled batch.

## 21–24. Authorization, database, Redis, observability

Authorization is permission + capability + entitlement on enable and on MCP. Migration `068` is additive (`ON CONFLICT`, schema version 2). OpenTelemetry metrics named in section 60 are **NOT VERIFIED** as a complete set (`mcp.denied`, `offline.sync.conflict` not proven in this pass).

## 25–27. Testing, P4, P5

| Suite | Result |
|-------|--------|
| `commerce-capability.catalog.spec.ts` | P3 |
| `price-resolution.spec.ts` | P3 |
| `mcp-tools.commerce-p4.spec.ts` | P4 unit (existing) |
| `pos-checkout-stock.p4.spec.ts` | P4 unit (existing) |
| Pharmacy regression suite | **NOT RE-RUN** in this pass |
| Local drill `P5-LIVE-DRILL.json` | `2026-09-25T15:52:21.493Z`–`2026-09-25T15:52:33.145Z`, 76 migrations. Collection select n=200: p50 0.325 ms, p95 0.829 ms, p99 1.552 ms. Priority operation percentiles are in `BOUTIQUE-FINAL-REPORT.md`. `pg_dump -Fc` 634.332 ms, restore status 0, 1 row. Redis port 1 returned null in 0.49 ms; Postgres `SELECT 1` still 1.419 ms; Postgres port 1 refused in 0.991 ms. RabbitMQ publish/consume 71.646 ms; port 1 refused in 3.025 ms while Postgres still served. Scratch databases dropped. Not a production SLO |

## 28–30. Migration, documentation, regression

Migrations: `066` profiles, `067` facet catalog, `068` cosmetics facets. Rollback is forward-fix (capabilities are inserts; profile JSON can be restored from the previous version row if configuration versions are retained). Do not rewrite production rows in place beyond the additive profile union in `068`.

Docs: this file, `CAPABILITY_CATALOG.md`, `PROFILE_CATALOG.md`, phase 1–3 evidence audits.

Pharmacy files were not modified by `068`. Cross-profile tenants sharing one product/inventory/pricing/POS engine is the architecture; a five-tenant live drill was **not** executed.

## 31–32. Gaps and production blockers

| ID | Severity | Status | Gap |
|----|----------|--------|-----|
| C26-FE | High | NOT VERIFIED | No capability-driven UI (§50–56). Out of scope for this pass. |
| C26-MCP | Medium | P4 unit | READ tools delegate to Core catalog, pricing, and inventory. EXECUTE book/cosmetic/cash mutations require `confirmed: true` after permission and capability gates. `capability_enable` stays PREPARE. |
| C26-OFF | High | P3 unit | Replay checks live `configVersion`, `POS`, `pos:sync`, device, idempotency key, and an open session before checkout or payment. Not a live outage drill. |
| C26-P5 | Blocker for production | LOCAL DRILL | Numbers above, from one workstation. Not a production certificate |
| C26-IMP | Medium | LOCAL DRILL for PRODUCT | `test/fixtures/p5-products.json` imported `P5-CAP` and `P5-TEE` in 55.202 ms. The duplicate batch finished `FAILED` and did not leave `P5-OK2`. PRICE and CUSTOMER stay at the unit transaction tests |
| C26-VAR | Medium | P3 | `COSMETIC_VARIANTS` / product axes expand into Core SKUs (`069`) |
| C26-PHARM | Medium | P3 unit | Pharmacy unit suite re-run after this pass (220 tests). Not a live multi-tenant drill. |

Blockers in section 78 are **not closed** by this report: financial, stock, session, MCP, and offline integrity are not certified at P5.

## 33. Evidence matrix

| Criterion | Level | Verdict |
|-----------|-------|---------|
| COSMETICS_RETAIL = retail + extension + lot/FEFO | P3 | VERIFIED (composition) |
| Shade/brand/category on Product extension | P1–P2 | PARTIALLY VERIFIED |
| Expired/recalled lots unsellable | P3 | VERIFIED in Core allocator |
| Price chain customer → … → base | P3 | VERIFIED (`price-resolution.ts`) |
| Promotion stacking/priority | P3 | VERIFIED (existing promotion engine) |
| Sales does not own stock | P2 | VERIFIED (architecture) |
| Single Core procurement | P2 | VERIFIED |
| Returns dispositions | P3 | VERIFIED (WMS map, exchange plan, store-credit ledger) |
| MCP no bypass for existing tools | P4 unit | VERIFIED for permission, capability, and EXECUTE confirmation |
| Frontend from capabilities | — | NOT VERIFIED |
| P5 | Local drill | Measured on `DESKTOP-7VLQLDO`. Not a production certificate |
| Anti-duplication | P2 | VERIFIED (no second engines added) |
| Anti `businessType ===` as main logic | P2 | VERIFIED for new cosmetics/price code |

## 34. Final certification

**NOT CERTIFIED. PRODUCTION READY = NO.**

Scoped P3 facts that do hold: profile composition, cosmetics extension capabilities, Core lot/FEFO/recall, configurable price-list order, MCP permission/capability/EXECUTE confirmation, offline replay admission against the live business context, and import of products, prices, and customers in one transaction per batch. The local drill measured priority-operation latency, races, RabbitMQ, Redis, a product file import, a TCP MCP invoke, dead-port outages, and backup/restore. Frontend screens are still out of scope. Capture stores the acquirer outcome and does not mark a tender approved unless a gateway body says `approved: true`. No such approval was recorded in this run. Offline replay through `SyncOfflineOperationUseCase` was not run.
