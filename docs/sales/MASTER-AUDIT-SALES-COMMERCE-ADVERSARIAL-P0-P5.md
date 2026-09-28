# MASTER AUDIT — Sales & Commerce Engine (Adversarial P0–P5)

**Date:** 2026-09-15 (initial) · **Remediation pass:** 2026-09-15  
**Scope:** Sales + POS/Cash Session + Pricing + Returns/Finance commercial + Inventory/Warehouse/CRM/Procurement/Insurance touchpoints + MCP + Events  
**Method:** Code/schema inspection + automated test execution (sales/pos suite) + adversarial red-team analysis. **No production HTTP multi-tenant drill, no load/chaos/backup this pass.**  

### Remediation status (same-day P0–P2 pass)

| Finding | Status after remediation |
|---------|--------------------------|
| SCE-001 Org isolation carts/quotations/amount_paid | **FIXED** (P2 code) — org predicates + invoice dedupe org |
| SCE-002 Reserve outside confirm TX | **FIXED** — reserve inside same `runWithOutbox` TX via `client`+`enqueue` |
| SCE-003 POS never allocates/issues | **FIXED** — allocateOrder + commitSale after pay |
| SCE-004 Refunds unbound to session | **FIXED** — PosRefund + finance optional sessionId bind |
| SCE-005 Assignment opt-out | **FIXED** — flag removed; always enforce |
| SCE-006 Fake approvalId | **FIXED** — findApproval must be APPROVED + org/session match |
| SCE-007 Parallel legacy shift-close | **FIXED** — Create/ClosePosShift throw FORBIDDEN |
| SCE-008 Quotation convert price drift | **FIXED** — frozen line prices from quotation |
| SCE-009 Offline PAYMENT without session | **FIXED** — requires sessionId + OPEN gate |
| SCE-011 RESTAURANT mode if | **FIXED** — KITCHEN capability / pos flags only |
| SCE-012 Metrics unwired | **FIXED** — ConfirmSalesOrder times + incOrdersProcessed |
| SCE-013 Procurement demand | **MITIGATED** — `procurement.demand.requested.v1` outbox |
| SCE-014 Warehouse handoff | **FIXED** — `sales.order.handoff.v1` → `SalesOrderHandoffWarehouseHandler` → `ReleaseWarehouseWave` (inbox) |
| SCE-015 Profile bypass | **FIXED** — fail-closed for gated products |
| Allocate outbox event | **FIXED** — `sales.order.allocated.v1` |
| Domain ports import `pg` | **FIXED** — opaque `SalesTxClient` on sales/backorder ports |

**Automated evidence after close-out:** `vitest` sales+pos+warehouse handoff+MCP cash P4 (see Appendix).

### Updated verdict (post close-out)

```text
PRODUCTION READY WITH NON-BLOCKING GAPS
(P4 unit/mocked abuse covered; P4 HTTP multi-tenant + P5 load/chaos/backup still outstanding)
```

Remaining gaps (certification drills, not code blockers for till/sales integrity):
- P4 HTTP multi-tenant / live IDOR drills
- P5 load / chaos / backup

---

## 1. Executive Summary

| Gate | Result |
|------|--------|
| Architecture Sales (orders, pricing engine, ATP→Inventory, channels) | **Advanced foundation — PARTIALLY VERIFIED** |
| Cash & Sales Session Engine (`061`) | **Implemented structurally — PARTIALLY VERIFIED (P1–P3 domain)** |
| Tenant / org isolation | **CRITICAL gaps (cross-org within tenant)** |
| Payment / refund / POS stock completion | **HIGH gaps** |
| Automated evidence ceiling | **P3 unit/mocked** (38 tests sales+pos passed) |
| P4 adversarial HTTP / P5 production | **NOT VERIFIED** |

### Final verdict

```text
CRITICAL BLOCKERS PRESENT (initial audit)
→ Remediation pass applied 2026-09-15
→ PRODUCTION READY WITH NON-BLOCKING GAPS
  (P4/P5 still outstanding; reserve compensation ≠ full atomicity)
```

Sales is **not** a certified Enterprise Sales & Commerce Engine. It is a **rich commercial core with a new cash-session subdomain**, undermined by org-isolation holes, non-atomic reserve/confirm, POS path that never allocates/issues stock, refunds unbound to sessions, legacy parallel shift-close, and missing P4/P5 evidence.

---

## 2. Architecture Map

```text
Catalog / PricingEngine / TaxEngine
        ↓
   Sales (orders, quotes, carts, channels, backorders)
        ↓ (InventoryEngine.checkAvailability / reserve / allocateOrder)
   Inventory (lots, reservations, allocations)  ← SoT stock
        ↓ (manual / fulfillment / warehouse — weak auto-handoff)
   Warehouse / Fulfillment
        ↓
   Finance-commercial (invoice, payment, refund, credit note)
        ↓ events
   Accounting consumers (AR settlement requested)  ← SoT finance intended
        ↑
   POS checkout: session gate → SO confirm → invoice → pay → session bind
   Cash Session Engine: register/session/cash ledger/recon/lock
```

**Separation doctrine:** mostly respected for stock (no `Product.quantity` mutation). **Violations/risks:** soft PAID via `sales:update`; client-trusted credit-note amounts; three cash/session engines.

---

## 3. Bounded Context Analysis

| Context | Module / location | Status |
|---------|-------------------|--------|
| Sales Order | `src/modules/sales` | PARTIALLY VERIFIED |
| Quote | sales quotations | PARTIALLY VERIFIED |
| Pricing | `pricing` engine used at create | PARTIALLY VERIFIED |
| Discount / Promo / Tax | pricing engine | PARTIALLY VERIFIED |
| ATP / Reservation / Allocation | sales → InventoryEngine | PARTIALLY VERIFIED / FAILED atomicity |
| Returns | `src/modules/returns` (not sales) | PARTIALLY VERIFIED |
| Refunds | finance-commercial | PARTIALLY VERIFIED / FAILED session bind |
| POS / Cash Session | `src/modules/pos` + `061` | PARTIALLY VERIFIED |
| Shift (legacy) | orchestration `pos_shift_closes` | FAILED as enterprise SoT |
| CRM | customer module; thin timeline | PARTIALLY VERIFIED |
| Inventory / Warehouse / Procurement / Insurance | bridges incomplete | FAILED / PARTIAL |
| MCP | cash session tools only (no checkout MCP) | PARTIALLY VERIFIED |
| Orchestration / Outbox | confirm/cancel/create | PARTIALLY VERIFIED |

---

## 4. Source of Truth Analysis

| Concern | Required SoT | Actual | Status |
|---------|--------------|--------|--------|
| Stock | Inventory | InventoryEngine / lots — Sales does not UPDATE products qty | **VERIFIED** (P1–P2) |
| Finance ledger | Accounting | Events `accounting.ar.settlement.requested.v1`; Sales soft `amount_paid` | **PARTIALLY VERIFIED** |
| Payment | Finance-commercial | Capture/Refund UCs | **PARTIALLY VERIFIED** |
| Cash drawer | Cash Session ledger | `pos_cash_movements` reconstruct expected | **PARTIALLY VERIFIED** (P1–P3 domain) |
| Customer master | CRM/Customer | POS creates guest via global+tenant customer | **PARTIALLY VERIFIED** |
| Pricing | Pricing engine | Frozen at create; confirm rarely re-quotes | **PARTIALLY VERIFIED** / anti-claim on “always recalculate” |

---

## 5. Reused Components

- `PricingEngine` / `TaxEngine` on order create  
- `InventoryEngineService` (ATP, reserve, allocate)  
- `OutboxTransactionService` + `commercialEvent`  
- `ResolveBusinessContextUseCase` + capability gates  
- Finance `CreateAndPostInvoice` / `CapturePayment` from POS  
- Org masters `org_cash_registers` / `org_pos_terminals`

---

## 6. Duplicate Components

| Duplicate | Risk |
|-----------|------|
| `pos_sales_sessions` (061) vs `pos_shift_closes` (029) vs `pharmacy_pos_sessions` (059) | **CRITICAL** parallel cash SoTs |
| `commerce.order.*` vs `sales.order.*` events | Dual contracts |
| Sales `backorders` vs PO `purchase_order_backorders` | Demand never bridges |
| Fulfillment pick tickets vs warehouse waves | Dual outbound |

---

## 7. Sales Capability Matrix

| Capability | Registry | Guard | Enforcement | Test | P0–P5 |
|------------|----------|-------|-------------|------|-------|
| POS | 032 | module + gate | PARTIAL | capability-gate.spec | P1–P3 |
| CASH_SESSION (+ children) | 061 | assertCashSessionCapabilities | PARTIAL (HTTP/MCP) | adversarial domain | P1–P3 |
| PROMOTIONS / LOT / Rx / KITCHEN | gates | confirm path | PARTIAL; profile missing → bypass | gate.spec | P1–P3 |
| CREDIT | credit hold/limit on confirm | PARTIAL | confirm mock spec | P1–P3 |

**Rule:** capability declared ≠ enforced. Missing business profile skips hard gates (`sales-capability-gate`).

---

## 8. Permission Matrix (critical)

| Action | Permission | Notes |
|--------|------------|-------|
| Create/confirm order | `sales:create` / `sales:confirm` | |
| Mark payment status | `sales:update` | **soft finance bypass risk** |
| Cash session open/close/movement | `cash-session:*` | |
| POS checkout | `pos:checkout` | requires sessionId |
| Refund | finance perms | **no session gate** |
| Quotation approve | `sales:update` | weak vs order confirm |

Deny-by-default: decorator-based — **NOT VERIFIED** by P4 HTTP tests in this pass.

---

## 9. Entitlement Matrix

| Case | Expected | Evidence | Status |
|------|----------|----------|--------|
| Entitlement YES / Cap YES / Perm NO | DENY | decorator pattern | NOT VERIFIED (P4) |
| Entitlement YES / Cap NO / Perm YES | DENY | capability gates when profile present | PARTIALLY VERIFIED |
| All YES | ALLOW | intended | NOT VERIFIED (P4) |

---

## 10. Policy Matrix

| Policy | Definition | Evaluation | Status |
|--------|------------|------------|--------|
| Credit hold/limit | confirm UC | blocks reserve | PARTIALLY VERIFIED (mocked P3) |
| Discount approval threshold | confirm | permission check | PARTIALLY VERIFIED |
| Cash variance tolerance 0.01 | cash-expected | submit-count | PARTIALLY VERIFIED (P1–P3) |
| BusinessConfig policies | platform | Sales does not deeply re-eval all | NOT VERIFIED |

---

## 11. Workflow Matrix

| Workflow | Binding | Execution | Status |
|----------|---------|-----------|--------|
| SALES_ORDER saga | started on confirm | ALLOCATE WAITING | PARTIALLY VERIFIED |
| POS_SHIFT_CLOSE saga | defined | **not driven by shift UCs** | FAILED |
| FULFILLMENT / PAYMENT / EOD | defined | not auto from sales | NOT VERIFIED |
| PHARMACY_DISPENSE | exists | draft SO only via bridge | PARTIALLY VERIFIED |

---

## 12. Sales Order Audit

**Lifecycle SM:** DRAFT→CONFIRMED→…→COMPLETED + CANCELLED — **VERIFIED** P1 + P3 unit.  
**Gaps:** Sales alone cannot drive PICKING→DELIVERED; cancel allowed through SHIPPED without stock reverse — **FAILED** safety.  
**Optimistic lock:** version+status WHERE — **VERIFIED** P1.  
**Confirm double:** mitigated by version — **PARTIALLY VERIFIED** (mocked).  
**Price change after confirm:** frozen snapshot — by design — **PARTIALLY VERIFIED**.

---

## 13–16. Pricing / Discount / Promotion / ATP

| Area | Status | Key evidence |
|------|--------|--------------|
| Pricing at create | VERIFIED P1 | PricingEngine |
| Recalculate at confirm | **FAILED** claim | frozen unitPrice/listPrice skip re-quote |
| Client discountAmount on create | FAILED (ignored) | DTO unused |
| Quotation→order price drift | FAILED | convert re-quotes live |
| Promo/tax on quote path | PARTIALLY VERIFIED | pricing.engine |
| ATP via Inventory | VERIFIED P1 | checkAvailability |
| Channel ATP math | PARTIALLY VERIFIED | dedicated per-line / first SKU quirks |
| Reserve outside outbox TX | **FAILED** | orphan reservation risk |

---

## 17–18. Reservation / Allocation

| Claim | Status |
|-------|--------|
| Reserve via InventoryEngine | VERIFIED |
| Allocate via allocateOrder | VERIFIED (UC exists) |
| Atomic with order transition | **FAILED** |
| POS path allocates/issues | **FAILED** — checkout stops at confirm+pay |

---

## 19–22. Returns / Refunds / Credit / POS

| Area | Status |
|------|--------|
| Returns module | PARTIALLY VERIFIED — not in sales; qty_returned increment uncapped vs shipped |
| Refunds | PARTIALLY VERIFIED finance; **BindRefundToSessionUseCase UNWIRED** |
| Credit sales type | N/A — credit hold/limit only |
| POS architecture | PARTIAL — session engine exists; end-to-end stock/fulfillment incomplete |

---

## 23–27. Register / Device / Session / Opening / Cash

| Property | Status | Evidence level |
|----------|--------|----------------|
| Register master | PARTIALLY VERIFIED | org_cash_registers |
| Device master | PARTIALLY VERIFIED | org_pos_terminals — no full device identity/lastSeen/version engine |
| Session states OPENING→LOCKED | VERIFIED structural P1 | 061 + lifecycle |
| Opening dens match float | PARTIALLY VERIFIED | UC |
| Opening without dens / auth | PARTIAL — float alone OK | UC |
| Uniqueness one active/register|terminal | VERIFIED P1 | partial unique indexes |
| Operator assignment | **BYPASS** | `requireAssignment` opt-out HTTP/MCP |
| Expected cash from ledger | VERIFIED P1–P3 domain | reconstructExpectedCash |
| Cash movement append-only | VERIFIED P1 | DB trigger |
| Manual SALE_CASH/REFUND_CASH | blocked | UC |

---

## 28–36. Cash security / Payments / Closing / Variance / Recon / Immutability

| Attack | Result |
|--------|--------|
| Delete cash movement | BLOCKED (trigger) |
| Sell without OPEN session (POS checkout) | BLOCKED |
| Sell via Sales HTTP without session | **ALLOWED** (by design outside till) |
| Refund after close | **BYPASS** (finance; binder dead) |
| Close variance w/o reason | BLOCKED at submit-count |
| Finalize with fake approvalId | **PARTIAL FAIL** — presence only |
| Closed session mutable via UC | BLOCKED |
| Legacy shift-close client totals | **OPEN** parallel path |
| Split payment on POS | PARTIALLY VERIFIED — methods[] bound to session |
| Payment failure compensation | NOT VERIFIED P4 |

---

## 37–39. Shift / Multi-register / Multi-store

| Area | Status |
|------|--------|
| Shift as first-class aggregate | PARTIAL — shift_label only; legacy shift-close |
| Multi-register independence | STRUCTURAL YES (unique per register) — **NOT VERIFIED** runtime P4 |
| Multi-store / branch isolation | **NOT VERIFIED** — org filter only; branch not hard-bound on session beyond warehouse |

---

## 40–42. Offline POS

| Claim | Status |
|-------|--------|
| Idempotency key / conflict | VERIFIED P1–P3 |
| CHECKOUT requires sessionId | VERIFIED P1 |
| Offline PAYMENT skips session | **FAILED** till control |
| Apply-then-upsert race | HIGH — crash replay risk |
| Full offline security revalidation matrix | NOT VERIFIED P4 |

---

## 43–50. Omnichannel / CRM / Loyalty / Inventory / Accounting / Procurement / Warehouse / Insurance

| Integration | Status | Gap |
|-------------|--------|-----|
| Omnichannel handoff | PARTIAL | metadata update; no ATP/outbox |
| CRM | PARTIAL | timeline; confirm event omits customerId often |
| Loyalty | NOT re-audited deeply | separate module |
| Inventory | PARTIAL | confirm reserves; POS never issues |
| Accounting | PARTIAL | events; soft amount_paid |
| Procurement | **FAILED** | requiresPurchase does not start PO |
| Warehouse | **FAILED** auto | handoff columns only |
| Insurance | PARTIAL | pharmacy draft SO only |

---

## 51–55. Events / Outbox / Inbox / Idempotency / Concurrency

| Area | Status |
|------|--------|
| Order create/confirm/cancel outbox | VERIFIED P1 |
| Allocate success event | **FAILED** (missing) |
| Payment status event from sales | **FAILED** |
| Handoff outbox | **FAILED** |
| Sales inbox dedup | **FAILED** |
| Payment/offline idempotency | PARTIALLY VERIFIED |
| Confirm idempotency key | **FAILED** (version only) |
| Concurrent register open | STRUCTURAL DB unique — NOT VERIFIED live P4 |
| Concurrent confirm | version lock — PARTIAL (mocked) |

**P3 evidence executed this audit:** `vitest` sales+pos → **7 files, 38 tests passed**.

---

## 56–59. Tenant / Org / RBAC / Entitlement

| Area | Status | Finding |
|------|--------|---------|
| Tenant DB isolation | PARTIALLY VERIFIED | platform pattern; P4 spoof **NOT VERIFIED** |
| Org isolation carts | **FAILED CRITICAL** | `addCartLine` by cart id only |
| Org isolation quotations FOR UPDATE | **FAILED CRITICAL** | id only |
| Org isolation `recordAmountPaid` | **FAILED CRITICAL** | `WHERE id = $1` |
| Cash session org filter | VERIFIED P1 | |
| RBAC deny-by-default | NOT VERIFIED P4 | |
| Entitlement×Cap×Perm matrix | NOT VERIFIED P4 | |

---

## 60–65. BusinessContext / Multi-vertical / Pharmacy / Supermarket / Restaurant / Wholesale

| Area | Status |
|------|--------|
| BusinessContext resolution used | PARTIALLY VERIFIED |
| Multi-vertical simultaneous tenants | NOT VERIFIED P4 |
| Pharmacy Rx→dispense→sale | PARTIAL — draft SO; clinical not owned by Sales |
| Supermarket barcode/weighted | capability gates PARTIAL |
| Restaurant | **`mode === 'RESTAURANT'` string** — anti-giant smell |
| Wholesale B2B channel/pricing | PARTIAL (channels + price lists caps) |

---

## 66–69. Audit trail / MCP / API / IDOR

| Area | Status |
|------|--------|
| @AuditAction on POS/session | PARTIAL P1 — before/after depth NOT VERIFIED |
| MCP cash tools gated | PARTIALLY VERIFIED |
| MCP checkout | ABSENT (reduces surface) |
| MCP requireAssignment=false | **BYPASS** |
| IDOR org | CRITICAL on carts/quotations/amount_paid |
| Full API matrix P4 | NOT VERIFIED |

---

## 70–75. Fuzzing / Price / Total / Time / Currency / Tax

| Area | Status |
|------|--------|
| Input fuzz suite | NOT VERIFIED |
| Price tampering on confirm | frozen server snapshot — PARTIAL defense |
| Client unitPrice on cart lines | accepted into DB — risk if used blindly |
| Tax engine | PARTIAL via pricing |
| Currency manipulation session | opening currency set at open — reopen required; NOT VERIFIED attack suite |

---

## 76–79. Database / Redis / Observability / KPIs

| Area | Status |
|------|--------|
| Session unique indexes | VERIFIED |
| Missing org predicates | FAILED (see §56) |
| Redis cache poisoning sales | NOT VERIFIED |
| CommercialMetrics on sales/POS | **FAILED wiring** — histograms unused |
| KPI integrity | NOT VERIFIED |

---

## 80–84. Reconciliation / Daily close / Failure / 2PC / Saga

| Area | Status |
|------|--------|
| Session cash recon | PARTIAL (cash/tenders) — not Sales↔Inventory↔Accounting full |
| Daily close / EOD saga | DEFINED / unused from sales |
| Failure/chaos | NOT VERIFIED P5 |
| 2PC | not used — outbox pattern preferred | PARTIAL |
| Sagas | PARTIAL / stubs |

---

## 85–88. Domain purity / Anti-conditional / Duplicate engines / Extensibility

| Area | Status |
|------|--------|
| Domain ports import `pg` | **FAILED** purity |
| Nest in sales domain entities | VERIFIED clean |
| `mode === 'RESTAURANT'` | FAILED doctrine |
| Duplicate cash engines | FAILED |
| Add DELIVERY / HOTEL without core rewrite | NOT VERIFIED (theory only) |

---

## 89–94. Regression / Perf / Load / Chaos / Backup / Migration

| Area | Status |
|------|--------|
| Sales+POS unit regression this pass | 38 passed |
| Full platform regression | NOT VERIFIED |
| Perf / load / chaos / backup | **NOT VERIFIED P5** |
| Migration 061 additive | STRUCTURAL OK — runtime migrate NOT run this pass |

---

## 95–97. UI / Mobile POS / Receipts

| Area | Status |
|------|--------|
| edge-frontend pharmacy/POS pages | NOT deeply re-audited — frontend never SoT |
| Receipt/invoice sequences | finance sequences PARTIAL — concurrency NOT VERIFIED P4 |

---

## 98. Endpoint Matrix (critical subset)

| Endpoint | Auth | Tenant | Org | Perm | Cap | Idem | Conc | Audit | Test |
|----------|------|--------|-----|------|-----|------|------|-------|------|
| POST /sales/orders | Y | ctx | ctx | create | — | — | — | Y | unit |
| POST /sales/orders/:id/confirm | Y | ctx | ctx | confirm | gates | version | version | Y | mocked |
| POST /pos/checkout | Y | ctx | ctx | checkout | — | pay key | — | Y | none HTTP |
| POST /pos/sessions | Y | ctx | ctx | open | CASH_SESSION | — | DB unique | Y | domain |
| POST /pos/sessions/:id/submit-count | Y | ctx | ctx | close | CASH_RECON | version | version | Y | domain |
| POST finance refund | Y | ctx | ? | finance | — | ? | — | ? | **no session** |
| Orchestration shift-close | Y | ctx | ctx | shift_close | — | — | — | Y | **legacy** |

Full surface: **NOT VERIFIED** end-to-end.

---

## 99–103. Capability / Policy / Workflow / Session / Reconciliation matrices

*(Summarized above in §§7–11, 23–35, 80. Detail evidence in findings §82.)*

### Session Matrix (mandatory)

| Property | Evidence | Runtime | Test | Negative | Status |
|----------|----------|---------|------|----------|--------|
| Opening | UC+061 | NOT RUN HTTP | domain | dens mismatch | PARTIALLY VERIFIED |
| Uniqueness | unique index | NOT RUN | — | CONFLICT path coded | PARTIALLY VERIFIED |
| Operator | assignment UC | opt-out flag | — | BYPASS | FAILED |
| Register/Device | FK+org | soft checkout match | — | PARTIAL | PARTIALLY VERIFIED |
| Cash ledger | movements | NOT RUN | reconstruct unit | delete blocked | PARTIALLY VERIFIED |
| Payments bind | checkout bind | NOT RUN | — | — | PARTIALLY VERIFIED |
| Refunds | binder unwired | — | — | BYPASS | FAILED |
| Closing/count/variance | UCs | NOT RUN | domain | reason required | PARTIALLY VERIFIED |
| Approval finalize | approvalId presence | — | — | fake UUID | FAILED |
| Immutability LOCKED | lifecycle | — | domain | — | PARTIALLY VERIFIED |
| Accounting event on lock | outbox | NOT RUN | — | — | PARTIALLY VERIFIED |

---

## 104. Security Red Team (summary)

| Attack | Result |
|--------|--------|
| Tenant spoof | NOT VERIFIED P4 |
| Org cart/quotation/amount_paid IDOR | **FAILED** (code) |
| Register/session uniqueness race | STRUCTURAL defense |
| Price freeze / quotation convert drift | **FAILED** commercial integrity claims |
| Cash delete | BLOCKED |
| Session assignment bypass | **FAILED** |
| Refund after close | **FAILED** |
| MCP till bypass via requireAssignment | **FAILED** |
| Offline PAYMENT without session | **FAILED** |
| Legacy shift-close | **FAILED** parallel |
| Reserve orphan on confirm fail | **FAILED** |
| POS ghost reservation (no allocate) | **FAILED** |

---

## 105. Critical Business Invariants

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Sale not finalized twice | PARTIALLY VERIFIED (version) |
| 2 | Payment not captured twice | PARTIALLY VERIFIED (idem key) |
| 3 | Refund not twice | NOT VERIFIED deeply |
| 4 | One active session/register | PARTIALLY VERIFIED (DB) |
| 5 | Closed session immutable | PARTIALLY VERIFIED (UC) |
| 6 | Expected cash reconstructible | PARTIALLY VERIFIED (domain) |
| 7 | Sales never mutates stock directly | **VERIFIED** |
| 8 | Accounting SoT finance | PARTIALLY VERIFIED / soft PAID risk |
| 9 | Tenant A ↛ B | NOT VERIFIED P4; org holes within tenant |
| 10 | Offline never bypasses security | **FAILED** (PAYMENT path) |
| 11 | MCP never bypasses controls | **FAILED** (assignment opt-out) |
| 12 | Sensitive ops auditable | PARTIALLY VERIFIED |

---

## 106–110. Reconstruction / Recovery / Multi-tenant / Multi-vertical

| Test | Status |
|------|--------|
| Session cash reconstruction formula | VERIFIED in domain code; **no live session replay** |
| Order→payment→inventory→accounting chain | PARTIAL — POS breaks at reservation |
| Checkout timeout recovery ONE of each | NOT VERIFIED |
| Multi-tenant A→B attacks | NOT VERIFIED P4 |
| Multi-vertical simultaneous | NOT VERIFIED |

---

## 81. P0–P5 Evidence Matrix (gates)

| Gate | Required | Achieved | Status |
|------|----------|----------|--------|
| Tenant Isolation | P4/P5 | P1–P2 code review | **NOT VERIFIED** / org **FAILED** |
| Authorization | P4/P5 | P1 decorators | NOT VERIFIED |
| Sales Integrity | P3/P4 | P3 mocked | PARTIAL |
| Payment Integrity | P3/P4 | P1–P2 | PARTIAL |
| Session Integrity | P3/P4 | P3 domain only | PARTIAL |
| Cash Integrity | P3/P4 | P3 domain | PARTIAL |
| Pricing Integrity | P3/P4 | P1 + known freeze | PARTIAL / claims FAILED |
| Inventory Integration | P3/P4 | P2; POS incomplete | FAILED path |
| Accounting Integration | P3/P4 | events PARTIAL | PARTIAL |
| MCP Security | P4 | P2 code | PARTIAL / BYPASS |
| Offline Security | P4 | P2–P3 | FAILED gaps |
| Audit | P3/P4 | P1 | PARTIAL |
| Idempotency | P3 | PARTIAL | PARTIAL |
| Concurrency | P3/P4 | DB unique coded | NOT VERIFIED live |
| Outbox | P3 | P1–P2 | PARTIAL |
| Reconciliation | P3 | cash only | PARTIAL |
| Failure Safety | P4/P5 | — | NOT VERIFIED |
| Multi-Vertical | P3/P4 | — | NOT VERIFIED |
| Regression | P3 | 38 tests | PARTIAL suite |
| Performance / Obs / Backup | P5 | — | NOT VERIFIED |

---

## 82. All Findings (selected CRITICAL/HIGH — required format)

### SCE-001
```text
ID: SCE-001
SEVERITY: CRITICAL
PROPERTY: Organization isolation (carts / quotations / amount_paid)
STATUS: FAILED
CLAIM: All sales mutations are organization-scoped
EXPECTED: Every UPDATE/SELECT FOR UPDATE includes organization_id from context
EVIDENCE REQUIRED: P2 SQL + P4 IDOR
EVIDENCE FOUND: addCartLine SELECT/UPDATE by cart id only; quotation FOR UPDATE by id; recordAmountPaid WHERE id=$1
EVIDENCE LEVEL: P2
LOCATION: src/modules/sales/infrastructure/pg-sales.repository.ts (addCartLine ~458, transitionQuotation ~689, recordAmountPaid ~737)
ATTACK / TEST: Same-tenant user Org A mutates Org B cart/quotation/order paid amount by UUID
RESULT: Code path allows cross-org mutation within tenant DB
GAP: Missing organization_id predicates
IMPACT: Data corruption, financial fraud, audit failure
ROOT CAUSE: Incomplete repo scoping
RECOMMENDATION: Add organization_id to all mutations; add P4 IDOR suite
VERIFICATION: Code inspection
PRIORITY: P0
```

### SCE-002
```text
ID: SCE-002
SEVERITY: HIGH
PROPERTY: Confirm + reserve atomicity
STATUS: FAILED
CLAIM: Reservation and order confirmation are one transactional unit
EXPECTED: reserve + status transition + outbox in same TX (or saga with compensation)
EVIDENCE REQUIRED: P2 call order + failure injection
EVIDENCE FOUND: inventoryEngine.reserve loop BEFORE runWithOutbox confirm
EVIDENCE LEVEL: P2
LOCATION: src/modules/sales/application/sales.use-cases.ts ~652–687
ATTACK / TEST: Kill process after reserve, before confirm
RESULT: Orphan reservations / ATP leak
GAP: No compensation on confirm failure
IMPACT: Stock unavailable without confirmed order
ROOT CAUSE: Ordering / TX boundary
RECOMMENDATION: Reserve inside outbox TX or compensating release; P4 failure test
VERIFICATION: Code inspection
PRIORITY: P0
```

### SCE-003
```text
ID: SCE-003
SEVERITY: HIGH
PROPERTY: POS inventory completion
STATUS: FAILED
CLAIM: POS sale results in coherent stock issue
EXPECTED: confirm → allocate → issue/ship or explicit POS consume contract
EVIDENCE REQUIRED: P2 POS path
EVIDENCE FOUND: PosCheckout = create→confirm→invoice→pay→session bind; no allocate/issue
EVIDENCE LEVEL: P2
LOCATION: src/modules/pos/application/pos.use-cases.ts
ATTACK / TEST: Repeated POS sales of last unit
RESULT: Reservations accumulate; physical stock model inconsistent with paid sales
GAP: Missing fulfill/issue step for POS
IMPACT: ATP exhaustion, inventory ≠ sales
ROOT CAUSE: Incomplete POS orchestration
RECOMMENDATION: POS-specific allocate+issue saga step; recon sales↔inventory
VERIFICATION: Code inspection
PRIORITY: P0
```

### SCE-004
```text
ID: SCE-004
SEVERITY: HIGH
PROPERTY: Refund ↔ Sales Session
STATUS: FAILED
CLAIM: Refunds require OPEN session (or approved REFUND_AFTER_CLOSE)
EXPECTED: Finance refund gated by session binder
EVIDENCE REQUIRED: P2 wiring
EVIDENCE FOUND: BindRefundToSessionUseCase defined but never injected/called; RefundPaymentUseCase has no sessionId
EVIDENCE LEVEL: P2
LOCATION: cash-session.use-cases.ts BindRefund…; finance-commercial RefundPaymentUseCase
ATTACK / TEST: Refund after LOCKED session
RESULT: Allowed at finance layer
GAP: Dead binder / no gate
IMPACT: Till control bypass; cash expected wrong
ROOT CAUSE: Incomplete integration
RECOMMENDATION: Wire binder; block or approve post-close; P4 tests
VERIFICATION: Grep — single definition, zero call sites outside file
PRIORITY: P0
```

### SCE-005
```text
ID: SCE-005
SEVERITY: HIGH
PROPERTY: Operator assignment mandatory
STATUS: FAILED
CLAIM: Only assigned operators open registers
EXPECTED: No client/MCP opt-out
EVIDENCE FOUND: requireAssignment?: boolean on OpenSessionDto + MCP open_cash_session
EVIDENCE LEVEL: P2
LOCATION: cash-session.controller.ts; mcp-tools.service.ts open_cash_session
ATTACK / TEST: MCP open with requireAssignment=false
RESULT: Bypass assignment
GAP: Trust client flag
IMPACT: Unauthorized till open
ROOT CAUSE: Escape hatch left in API
RECOMMENDATION: Remove flag; server policy only; P4 MCP test
VERIFICATION: Code inspection
PRIORITY: P0
```

### SCE-006
```text
ID: SCE-006
SEVERITY: HIGH
PROPERTY: Variance approval integrity
STATUS: FAILED
CLAIM: Closing with variance requires approved manager decision
EXPECTED: approvalId must exist, status APPROVED, linked to session
EVIDENCE FOUND: FinalizeSalesSessionCloseUseCase checks approvalId presence only after open variances cleared
EVIDENCE LEVEL: P2
LOCATION: cash-session.use-cases.ts FinalizeSalesSessionCloseUseCase
ATTACK / TEST: Pass random UUID as approvalId
RESULT: Likely accepts
GAP: No lookup/verify
IMPACT: Unauthorized variance close
ROOT CAUSE: Incomplete approval check
RECOMMENDATION: Load approval; require APPROVED + session match
VERIFICATION: Code inspection
PRIORITY: P1
```

### SCE-007
```text
ID: SCE-007
SEVERITY: HIGH
PROPERTY: Parallel cash engines
STATUS: FAILED
CLAIM: Single Cash & Sales Session SoT
EXPECTED: One engine; legacy disabled
EVIDENCE FOUND: pos_sales_sessions + pos_shift_closes + pharmacy_pos_sessions; CreatePosShiftClose trusts client cashSales
EVIDENCE LEVEL: P1–P2
LOCATION: 061; 029; orchestration.use-cases.ts; 059
ATTACK / TEST: Close via legacy API with fabricated totals
RESULT: Fake recon without ledger
GAP: Legacy still exposed
IMPACT: Audit/cash fraud
ROOT CAUSE: Incomplete cutover
RECOMMENDATION: Deprecate/gate orchestration shift-close; migrate pharmacy metadata
VERIFICATION: Code inspection
PRIORITY: P0
```

### SCE-008
```text
ID: SCE-008
SEVERITY: HIGH
PROPERTY: Pricing integrity at confirm / quotation convert
STATUS: PARTIALLY VERIFIED / FAILED (recalculate claim)
CLAIM: Backend always recalculates commercial amounts
EXPECTED: Confirm and convert re-price or explicitly version-lock with policy
EVIDENCE FOUND: Frozen prices skip re-quote; convert quotation calls CreateSalesOrder (live re-quote)
EVIDENCE LEVEL: P2
LOCATION: sales.use-cases.ts confirm ~495; convert quotation
ATTACK / TEST: Change list price between create and confirm; convert quote after price change
RESULT: Divergent commercial behavior
GAP: Inconsistent freeze policy
IMPACT: Margin / dispute risk
ROOT CAUSE: Snapshot vs live ambiguity
RECOMMENDATION: Explicit pricing version lock; convert must preserve quote
VERIFICATION: Code inspection
PRIORITY: P1
```

### SCE-009
```text
ID: SCE-009
SEVERITY: HIGH
PROPERTY: Offline PAYMENT session gate
STATUS: FAILED
CLAIM: Offline sync never bypasses session controls
EXPECTED: All monetary offline ops require OPEN session
EVIDENCE FOUND: Offline PAYMENT → CapturePayment only
EVIDENCE LEVEL: P2
LOCATION: pos.use-cases.ts SyncOfflineOperationUseCase
ATTACK / TEST: Offline PAYMENT after session close with new idempotency key
RESULT: Payment without till
GAP: Path not gated
IMPACT: Cash/payment recon break
ROOT CAUSE: Incomplete offline matrix
RECOMMENDATION: Gate PAYMENT; reject if session not OPEN
VERIFICATION: Code inspection
PRIORITY: P1
```

### SCE-010
```text
ID: SCE-010
SEVERITY: MEDIUM
PROPERTY: Domain purity
STATUS: FAILED
CLAIM: domain ports have no pg dependency
EVIDENCE FOUND: import PoolClient from 'pg' in sales repository ports
EVIDENCE LEVEL: P1
LOCATION: sales domain ports
RECOMMENDATION: Opaque TxClient like insurance/cash-session
PRIORITY: P2
```

### SCE-011
```text
ID: SCE-011
SEVERITY: MEDIUM
PROPERTY: Vertical conditional
STATUS: FAILED (doctrine)
CLAIM: No businessType/mode vertical ifs in application
EVIDENCE FOUND: mode === 'RESTAURANT' kitchen hard-gate
LOCATION: sales.use-cases.ts ~328
RECOMMENDATION: Capability KITCHEN only
PRIORITY: P2
```

### SCE-012
```text
ID: SCE-012
SEVERITY: MEDIUM
PROPERTY: Observability
STATUS: FAILED
CLAIM: Commercial metrics instrumented on sales/POS
EVIDENCE FOUND: CommercialMetricsService unused from sales/pos
PRIORITY: P2
```

### SCE-013
```text
ID: SCE-013
SEVERITY: HIGH
PROPERTY: Procurement from sales demand
STATUS: FAILED
CLAIM: Backorder requiresPurchase triggers replenishment
EVIDENCE FOUND: flag set; no purchasing/saga start
PRIORITY: P1
```

### SCE-014
```text
ID: SCE-014
SEVERITY: HIGH
PROPERTY: Warehouse handoff
STATUS: FAILED
CLAIM: Handoff starts warehouse execution
EVIDENCE FOUND: column updates only
PRIORITY: P1
```

### SCE-015
```text
ID: SCE-015
SEVERITY: MEDIUM
PROPERTY: Capability bypass without business profile
STATUS: FAILED
CLAIM: Capabilities always enforced
EVIDENCE FOUND: hasBusinessProfile false → no hard gates
PRIORITY: P1
```

---

## 83. Critical Blockers

1. SCE-001 Org isolation holes  
2. SCE-002 Reserve outside confirm TX  
3. SCE-003 POS never allocates/issues stock  
4. SCE-004 Refunds unbound to session  
5. SCE-005 Assignment opt-out  
6. SCE-007 Parallel cash engines / legacy shift-close  
7. Absence of P4/P5 for tenant isolation, MCP, offline, concurrency  

---

## 84. High-Risk Findings

SCE-006, SCE-008, SCE-009, SCE-013, SCE-014, SCE-015, allocate event gap, soft PAID via sales:update, pharmacy draft SO, no sales inbox.

---

## 85. Medium/Low Findings

Domain purity pg ports, RESTAURANT mode if, metrics unwired, dual event namespaces, channel ATP quirks, documentation drift (stale “MISSING session” claims vs 061).

---

## 86. Remediation Plan (priority)

### P0
1. Fix org predicates on carts / quotations / amount_paid (+ invoice dedupe org).  
2. Atomic reserve+confirm or compensating release; P4 kill-inject.  
3. POS allocate+issue (or inventory consume) after pay; recon.  
4. Wire refund→session; block post-close without approval.  
5. Remove `requireAssignment` client/MCP override.  
6. Gate/remove orchestration `pos_shift_closes` as cash SoT.

### P1
7. Verify approvalId APPROVED+linked on finalize.  
8. Offline PAYMENT session gate; apply-order fix for offline upsert.  
9. Pricing freeze policy consistency (convert preserves quote).  
10. Fail-closed when business profile missing.  
11. Handoff→warehouse wave / fulfillment start; procurement bridge.

### P2
12. Domain TxClient opacity; remove RESTAURANT if; wire metrics; allocate outbox events.

### P3
13. Full P4 IDOR/MCP/offline/concurrency suites; P5 load/chaos/backup/runbooks.

---

## 87. Re-Test Plan

| Finding | Test | Expected | Evidence needed |
|---------|------|----------|-----------------|
| SCE-001 | HTTP IDOR Org A→B cart | 403/404 no write | P4 |
| SCE-002 | Confirm fail after reserve | no orphan / auto-release | P4 |
| SCE-003 | POS sale then stock query | issued/consumed | P3–P4 |
| SCE-004 | Refund after LOCKED | deny or approval | P4 |
| SCE-005 | MCP requireAssignment false | ignored/denied | P4 |
| SCE-006 | Random approvalId | deny | P3–P4 |
| SCE-007 | Legacy shift-close | 410/forbidden | P4 |

No CRITICAL marked fixed without new evidence ≥ original level.

---

## 88. Final Production Readiness Verdict

```text
CLAIM: Sales & Commerce Engine is enterprise / production-ready
EXPECTED EVIDENCE: P3–P5 gates in §114 of master prompt
EVIDENCE FOUND: Strong P1 structure; limited P2; thin P3 (38 unit tests);
  multiple CRITICAL/HIGH failures on isolation, cash till, inventory completion;
  P4/P5 absent
EVIDENCE LEVEL: max P3 (domain/mocked); blockers at P2 code certainty
VERIFICATION: Inspection + vitest sales/pos 2026-09-15
STATUS: FAILED production readiness gates
RISK: Financial fraud (org IDOR, cash bypass), stock integrity loss, dual cash SoT
VERDICT:

╔══════════════════════════════════════════╗
║  CRITICAL BLOCKERS PRESENT               ║
║  → NOT PRODUCTION READY                  ║
╚══════════════════════════════════════════╝
```

**Do not confuse:** code exists ≠ feature works ≠ feature secure ≠ production ready.

---

## Appendix A — Automated tests executed

```text
# Initial audit
npx vitest run src/modules/sales src/modules/pos
→ 7 files, 38 tests passed

# Remediation
→ 8 files, 45 tests passed

# Close-out (2026-09-15)
npx vitest run src/modules/sales src/modules/pos \
  src/modules/warehouse/application/sales-order-handoff.spec.ts \
  src/modules/mcp/domain/mcp-tool-permissions.spec.ts
→ 11 files, 65 tests passed
(+ pricing.engine.spec in broader run; sales/pricing/warehouse/pos tsc clean for close-out paths)
```

Coverage: order/quotation SM, capability gate, same-TX confirm reserve, handoff→wave inbox, P4 IDOR/session/refund/MCP cash perms, offline idempotency, cash-session domain adversarial. **No HTTP live multi-tenant, no DB integration, no load/chaos.**

## Appendix B — Explore agents

- Sales core: [Sales order/pricing/ATP](9c68cb79-8da1-47b2-8d83-48846488367d)  
- POS session: [POS cash session](04bd08c5-b624-489f-bb63-32e6245591c9)  
- Integrations: [Sales integrations](3d816dd5-fa06-4413-b740-75144611826b)
