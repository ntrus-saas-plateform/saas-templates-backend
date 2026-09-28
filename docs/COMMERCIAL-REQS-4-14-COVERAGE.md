# Coverage matrix — Requirements 4–14

Honest status after migrations `017` / `043` and follow-up implementation.

| # | Requirement | Status | What is in code |
|---|-------------|--------|-----------------|
| **4** | Customer Master | **COVERED** | Types (INDIVIDUAL…INSTITUTION); identity; contacts CRUD; BILLING/SHIPPING addresses; category/segment; price group; credit; payment terms; currency; status; tax profile; risk level/score; purchase history; default bill/ship address ids |
| **5** | Customer Groups | **COVERED** | Seeded Retail/Wholesale/Hospital/Pharmacy/VIP/Corporate/Government/Distributor/Internal; CRUD API; influence on price (price list + discount %), credit defaults, payment terms, promo eligibility flag, allocation_priority, SLA hours, delivery_priority |
| **6** | Sales Quotations | **COVERED** | Full SM DRAFT→…→CANCELLED; lines/prices/taxes/discounts; validUntil; conditions; attachment_refs; approval gate; notes; convert to SO; transition history |
| **7** | Sales Order Engine | **COVERED** | Full status enum + validated SM; transitions historized; audited endpoints (confirm/approve/payment/allocate/cancel/complete); confirm idempotent |
| **8** | Order Lines | **COVERED** | productId + SKU + uom + all qty buckets + unit/net/gross + discount + tax |
| **9** | Availability | **COVERED** | onHand, reserved, allocated, quarantine, blocked, recalled, expired, damaged, inTransit, available, sellable, ATP, physical, protected, safety, confirmedInbound (+ CTP via separate API) |
| **10** | ATP | **COVERED** | Configurable policy (`inventory_atp_policies` + sku policies): inbound, open orders, safety, protected, blocked; warehouse-scoped |
| **11** | CTP | **COVERED** | `computeCtp` from ATP + inbound schedule + optional supplier lead time; `POST /inventory/ctp` |
| **12** | Backorders | **COVERED** | Own table + lifecycle OPEN/PARTIAL/FULFILLED/CANCELLED/SUBSTITUTED; priority; expected date; supply source; create on allocate shortfall; cancel/partial fulfill/substitute APIs; outbox events |
| **13** | Allocation | **COVERED** | FEFO, FIFO, PRIORITY/CUSTOMER/CHANNEL, EXPIRY_RISK, MANUAL; hospital-before-retail priority test. RULE_BASED/MARGIN/ORDER map to FEFO until rules engine |
| **14** | FEFO | **COVERED** | Expiry ASC; skip expired/recalled/quarantine/blocked/damaged/non-sellable; temperature class + restrictions filters |

## Still PARTIAL (not blockers for 4–14)

- Confirm + reserve not one distributed TX
- Product substitution engine (backorder can mark SUBSTITUTED; full substitute catalog rules are FUTURE)
- Channel/customer/date knobs on ATP are policy-backed but not every dimension has a dedicated UI field yet
- OpenAPI refreshed (216 ops); FE clients still to rewire

## Migrations to apply

```bash
pnpm migrate:control
pnpm migrate:tenant <tenantId>
```

Needs `043_customer_master_complete` and `017_commercial_reqs_4_14`.
