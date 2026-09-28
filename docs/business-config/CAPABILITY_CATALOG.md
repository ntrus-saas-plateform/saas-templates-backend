# Capability Catalog (Vague 1)

Seeded in tenant DB (`capability_definitions`). Status legend:

- **AVAILABLE** — ready to enable when deps / vertical allow
- **EXPERIMENTAL** — declared; runtime engine may be PARTIAL; guards may lock
- **DEPRECATED** / **SUSPENDED** — not for new enables

## Core inventory / quality

| Code | Depends on | Notes |
|------|------------|-------|
| INVENTORY | — | Base stock module |
| LOT_TRACKING | INVENTORY | Lot identity |
| EXPIRATION | LOT_TRACKING | Expiry dates |
| FEFO | EXPIRATION, LOT_TRACKING | Materializes `enableFefo` + allocation FEFO |
| COLD_CHAIN | EXPIRATION | Pharmacy / healthcare |
| RECALL | LOT_TRACKING | Lot recall ops |
| CONTROLLED_PRODUCTS | INVENTORY | Controlled substances gating |
| MULTI_STORE | INVENTORY | Multi-location |

## Pharmacy / healthcare

| Code | Depends on | Verticals |
|------|------------|-----------|
| PRESCRIPTION | — | PHARMACY, HEALTHCARE_* (Wave 1 `054`) |
| DISPENSING | PRESCRIPTION | Sets `features.pharmacy.dispensing` |
| CONTROLLED_DRUGS / CONTROLLED_DRUG_REGISTER | DISPENSING / CONTROLLED_DRUGS | Wave 2 `055` |
| RECALL / PATIENT_RECALL | PHARMACY / RECALL | Wave 2 |
| PHARMACOVIGILANCE / MEDICATION_ERRORS | PHARMACY / DISPENSING | Wave 2 |
| CHRONIC_CARE / REFILL_MANAGEMENT | PRESCRIPTION / CHRONIC_CARE | Wave 2 |
| PHARMACY_ANALYTICS | PHARMACY | Wave 2 |
| PHARMACY_MCP / PHARMACY_MOBILE / PHARMACY_OFFLINE | PHARMACY | Wave 3 `056` — MCP / mobile / offline sync |
| PHARMACY_REPORTING | PHARMACY_ANALYTICS | Wave 3 analytics `056` |
| PHARMACY_INDUSTRIAL_OPS | PHARMACY | Wave 3 industrial foundation `064` (batch/PM/stability stubs — not MES) |
| PHARMACY_POS / PHARMACY_PROCUREMENT / PHARMACY_SUPPLIERS | PHARMACY | Wave 4 `059` — POS session / demand / supplier ext |
| PHARMACY_APPROVALS / PHARMACY_REGULATORY / PHARMACY_LOYALTY | PHARMACY | Wave 4 `059` — approvals / regulatory profiles / loyalty gate |
| MEDICATION_ADHERENCE / EXPIRATION_MANAGEMENT | CHRONIC_CARE / LOT_TRACKING | Wave 4 `059` |
| ACTIVE_INGREDIENTS / ATC_CLASSIFICATION / SERIALIZATION | PHARMACY / LOT_TRACKING | Wave 4 `059` — caps seeded; engines mostly catalog |
| INSURANCE | — | Real engine `vertical-ops` (AVAILABLE after `038` / Wave 1 `051`) |

Docs: [docs/pharmacy/ARCHITECTURE.md](../pharmacy/ARCHITECTURE.md)

### Insurance child capabilities (Waves 1–3 — `051` / `052` / `053`)

| Code | Depends on | Notes |
|------|------------|-------|
| INSURANCE_PROVIDER / PAYER_MANAGEMENT / INSURANCE_PLAN | INSURANCE | Master data |
| INSURANCE_POLICY / MEMBERSHIP / COVERAGE / BENEFITS / ELIGIBILITY | INSURANCE | Policy lifecycle |
| PATIENT_RESPONSIBILITY / COVERAGE_LIMITS | INSURANCE / COVERAGE | Cost share + ledgers |
| CLAIMS / CLAIM_SUBMISSION | INSURANCE | Claim draft → submit |
| INSURANCE_AUTHORIZATION | INSURANCE | Prior auth (Wave 2) |
| CLAIM_ADJUDICATION / CLAIM_DENIAL | CLAIMS | Adjudicate / deny / appeal |
| CLAIM_RECONCILIATION | CLAIMS | Remittance discrepancies (Wave 3 `053`) |
| PROVIDER_NETWORK / INSURANCE_CONTRACTS / INSURANCE_TARIFFS | INSURANCE | Network & pricing |
| INSURANCE_DOCUMENTS / INSURANCE_ATTACHMENTS | INSURANCE / CLAIMS | Metadata only |
| INSURANCE_WORKFLOWS / INSURANCE_ANALYTICS | INSURANCE | Workflows + KPIs (Wave 3) |

Docs: [docs/insurance/ARCHITECTURE.md](../insurance/ARCHITECTURE.md)

## CRM (Wave 1 — migration `043`)

| Code | Depends on | Notes |
|------|------------|-------|
| CRM | plan module `customer` | Core CRM |
| CUSTOMER_MANAGEMENT / CONTACT_MANAGEMENT | CRM | Master + contacts |
| LEAD_MANAGEMENT / PROSPECT_MANAGEMENT | CRM | Leads → prospects |
| OPPORTUNITY_MANAGEMENT | CRM | Configurable pipeline stages |
| ACTIVITY_MANAGEMENT / TASK_MANAGEMENT / NOTE_MANAGEMENT | CRM | Engagement |
| CUSTOMER_TIMELINE / CUSTOMER_360 | CRM | Projection / consolidated view |
| CUSTOMER_SEGMENTATION / CUSTOMER_GROUPS / CUSTOMER_SCORING | CRM | Segments & scoring |
| CAMPAIGNS / CAMPAIGN_AUDIENCES | CRM | Campaign skeleton |
| CUSTOMER_CREDIT | CRM (+ sales) | CRM credit profile — **not** AR ledger |
| CRM_ANALYTICS | CRM | Dashboard aggregates |
| PATIENT | CRM (+ pharmacy) | Vertical extension — not forced on all tenants |

Docs: [docs/crm/ARCHITECTURE.md](../crm/ARCHITECTURE.md)

## Warehouse & Logistics (Wave 1 — `047` / Wave 2 — `049`)

| Code | Depends on | Notes |
|------|------------|-------|
| WAREHOUSE | inventory module | Execution BC — **not** stock SoT |
| MULTI_WAREHOUSE | WAREHOUSE | Multi-WH fulfillment |
| INBOUND | WAREHOUSE | Inbound family |
| ASN / RECEIVING / DOCK_APPOINTMENTS / PUTAWAY | INBOUND chain | ASN → receive → Inventory.receiveLot → putaway |
| OUTBOUND | WAREHOUSE | Outbound family |
| PICKING / WAVE_PICKING / BATCH_PICKING / ZONE_PICKING / CLUSTER_PICKING | OUTBOUND | Strategies via fulfillment bridge |
| PACKING / HANDLING_UNITS / SHIPPING | OUTBOUND | Pack + HU + dispatch (`commitIssue`) |
| SPLIT_SHIPMENT / PARTIAL_FULFILLMENT | SHIPPING / OUTBOUND | Bridge existing fulfillment plan |
| WAREHOUSE_TASKS | WAREHOUSE | Generic task engine |
| OFFLINE_WAREHOUSE / MOBILE_WAREHOUSE / MOBILE_SCANNER | WAREHOUSE | Offline sync + mobile (Wave 2) |
| CARRIER / CARRIER_RATE_SHOPPING / TRACKING | SHIPPING | Adapter port (noop default; live carriers NOT VERIFIED) |
| RETURNS_LOGISTICS | WAREHOUSE | Return shipment + disposition |
| COLD_CHAIN_LOGISTICS | WAREHOUSE | Excursion quarantine hooks |
| DOCK_MANAGEMENT | INBOUND | Dock ops |
| CROSS_DOCKING / YARD / FLEET / ROUTE_PLANNING / WORKFORCE / PERFORMANCE | — | EXPERIMENTAL / NOT VERIFIED |

Docs: [docs/warehouse/ARCHITECTURE.md](../warehouse/ARCHITECTURE.md)

## Commerce / POS

| Code | Notes |
|------|-------|
| POS | Materializes mobile POS flags |
| CASH_SESSION | Register/session open→lock lifecycle (depends on POS; migration `061`) |
| CASH_MOVEMENT | Cash-in/out, safe drop, pickup, transfers |
| CASH_RECONCILIATION | End-of-shift count + tender recon |
| CASH_VARIANCE_APPROVAL | Manager approval for cash variances |
| PROMOTIONS | Commercial promotions |
| LOYALTY | `enableLoyalty` / `commerce.loyalty` |
| BARCODE | Scanner / POS |
| WEIGHTED_PRODUCTS | Supermarket (EXPERIMENTAL) |
| VARIANTS | Retail (EXPERIMENTAL) |
| PRODUCT_VARIANTS | Retail (EXPERIMENTAL) — Phase 2: gated `PUT /catalog/products/:id/variants` writes `retail.variants` (axes/options **PARTIAL**, no matrix engine) |
| CREDIT | Wholesale credit |
| PRICE_LISTS | B2B price lists |
| B2B | Wholesale / distribution |
| BULK | Bulk order (EXPERIMENTAL) |

### Commerce profiles Phase 1 (migration `066`)

| Code | Depends on | Notes |
|------|------------|-------|
| GENERAL_COMMERCE | — | Parent commerce marker; composition base for retail profiles |
| STORE_MANAGEMENT | GENERAL_COMMERCE | Store ops marker (maps to multi-store / cash-session world) |
| MULTI_REGISTER | — | Multi-register / cash-session sibling (if not already Core) |
| BOOKSTORE | GENERAL_COMMERCE | Bookstore vertical gate |
| BOOK_CATALOG | BOOKSTORE | Book catalog search / manage |
| ISBN | BOOKSTORE | ISBN-10/13 validate + `product_isbn_index` uniqueness |
| STATIONERY | GENERAL_COMMERCE | Stationery attributes extension marker |
| COSMETICS_RETAIL | GENERAL_COMMERCE | Cosmetics retail vertical gate |
| COSMETIC_PRODUCT | COSMETICS_RETAIL | Cosmetic product attributes + search-by-shade |

Docs: [docs/commerce/PHASE1-EVIDENCE-AUDIT.md](../commerce/PHASE1-EVIDENCE-AUDIT.md)

### Commerce facet catalog (`067`)

Source of truth in code: `src/modules/business-config/domain/commerce-capability.catalog.ts`.
Seed: `migrations/tenant/067_commerce_capability_catalog.sql`.

Profiles compose capabilities. A capability (for example `SALES_ORDER`, `STOCK_LEDGER`, `PAYMENTS`) is reusable across `GENERAL_COMMERCE`, `RETAIL_STORE`, `STATIONERY_BOOKSTORE`, and `COSMETICS_RETAIL`.

| Profile | Composition |
|---------|-------------|
| GENERAL_COMMERCE | Core commerce facets (sales, POS session, catalog, pricing, payments, returns, inventory ledger, procurement, warehouse). No bookstore or cosmetics markers. |
| RETAIL_STORE | GENERAL_COMMERCE + store location/register/staff + in-store / click-and-collect |
| STATIONERY_BOOKSTORE | RETAIL_STORE + `BOOK_*` / `ISBN` extensions + stationery categories + B2B pricing/credit. Book remains a Product extension. |
| COSMETICS_RETAIL | RETAIL_STORE + `COSMETIC_PRODUCT_ATTRIBUTES` + lot / expiration / FEFO |

Each capability row carries `implementationMode` (`NATIVE`, `CONFIGURABLE`, `EXTENSION`, `INTEGRATION`), family, scope, dependencies, and compatible profiles in `metadata`. Enable still rejects a capability whose dependencies are missing (`CAPABILITY_DEPENDENCY_MISSING`). Status values remain `AVAILABLE`, `ENABLED`, `DISABLED`, `SUSPENDED`, `DEPRECATED`, `EXPERIMENTAL`.

`EXPERIMENTAL` (no production engine): none in the commerce facet catalog after `069`. Pharmacy, hospitality, and warehouse yard/fleet codes outside that catalog can still be experimental.

Configuration layers resolve `PLATFORM → INDUSTRY → PROFILE → TENANT → ORGANIZATION → LOCATION` with modes `INHERIT`, `OVERRIDE`, `LOCKED` (`config-resolution.ts`). Active tenant configuration stays versioned (`configurationVersion`). `BusinessContext` is frozen for the use-case call and carries user, membership, enabled/disabled capabilities, entitlements, permissions, locale, currency, timezone, and regulatory context.

Store policies (`return`, `discount`, `pricing`, `payment`, `credit`, `opening`, `closing`, `inventory`) live on `policyBundle.store` and are read from that context. Sales does not post the stock ledger; inventory movements stay on the inventory bounded context.

Docs: [docs/sales/CASH-SESSION-ENGINE.md](../sales/CASH-SESSION-ENGINE.md)

## Procurement (Wave 1 — migration `042`)

| Code | Depends on | Notes |
|------|------------|-------|
| PURCHASING | plan module `purchasing` | Core procurement engine |
| SUPPLIER_MANAGEMENT | PURCHASING | Supplier lifecycle / catalog mappings |
| RFQ | PURCHASING | Request for quotation |
| SUPPLIER_QUOTATION | RFQ | Quotes + comparison |
| THREE_WAY_MATCH | PURCHASING | PO / GR / supplier-invoice document match |
| LANDED_COST | PURCHASING (+ inventory module) | Landed cost documents / allocation |
| SUPPLIER_RETURNS | PURCHASING | Supplier credit / return coordination |

Docs: [docs/procurement/ARCHITECTURE.md](../procurement/ARCHITECTURE.md)

## Restaurant / hospitality

| Code | Status | Notes |
|------|--------|-------|
| RECIPES | EXPERIMENTAL | No recipe engine yet |
| KITCHEN | AVAILABLE (`038`) | KDS tickets in `vertical-ops` |
| TABLES | AVAILABLE (`038`) | Dining tables in `vertical-ops` |
| WASTE | EXPERIMENTAL | — |
| PMS | AVAILABLE (`038`) | Hotel rooms/stays/folio |
| ROOM_SERVICE / MINIBAR | AVAILABLE (`038`) | Folio charge types |
| MODIFIERS / BEDS / HOUSEKEEPING | EXPERIMENTAL | No dedicated engines |

## Resolution API

- List: `GET /api/v1/business-config/capabilities`
- Enable / disable: `POST .../capabilities/:code/enable|disable`
- Explain: `GET .../capabilities/:code/explain`

Enable validates dependencies, conflicts, vertical support, and **licensed plan modules**.
`EXPERIMENTAL` capabilities cannot be enabled manually (profile/pack only). The former commerce experimental set (`WEB_POS`, coupons, vouchers, promotion stacking, CTP, delivery, wallet, terminal, online payment, settlement, exchanges, store credit, supplier contracts, supplier performance, loading, online channel, bulk order, cosmetic variants) is **AVAILABLE** and runs on the existing Sales, Pricing, Inventory, Catalog, Purchasing, Warehouse, and Returns engines (`069`). Payment terminal, wallet, and online payment still require an external authorization reference; this platform does not invent an acquirer approval.

Coverage vs master prompt: [MASTER-PROMPT-COVERAGE.md](./MASTER-PROMPT-COVERAGE.md).
