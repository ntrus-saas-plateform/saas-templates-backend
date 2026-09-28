# Procurement Wave 1 — Evidence Audit

**Date:** 2026-09-12  
**Scope:** Extend `src/modules/purchasing` (not a greenfield module)  
**Global verdict:** **PARTIALLY VERIFIED → production-usable for Wave 1 scope**; Accounting AP ledger **NOT IN SCOPE / NOT VERIFIED**

## Architecture

| Item | Status |
|------|--------|
| Modules created | None (extended purchasing) |
| Modules modified | purchasing, mcp, business-config (workflow catalog), event-catalog |
| Reused | Outbox, inventory port, orchestration three-way evaluator, returns credit link, auth guards |

## Domain aggregates / services

Supplier lifecycle, PR/RFQ lifecycles, quotation comparison, purchasing policies, capability gate, PO SM (Wave 1 statuses), landed cost (existing).

## Capabilities

`PURCHASING` + `SUPPLIER_MANAGEMENT`, `RFQ`, `SUPPLIER_QUOTATION`, `THREE_WAY_MATCH`, `LANDED_COST`, `SUPPLIER_RETURNS` — seeded in `042`, gated on controller routes.

## Policies

Pure functions in `purchasing-policies.ts` (MOQ, min order, approval threshold, partial receipt, 3-way tolerances). **PARTIAL:** not yet rematerialized via `BusinessPolicyResolver` org SoT (config-driven defaults used).

## Workflows

Templates `PURCHASE_REQUISITION_APPROVAL_V1`, `PURCHASE_ORDER_APPROVAL_V1` in catalog. **PARTIAL:** auto-start from approve UCs not mandatory wired in all paths.

## Security

| Claim | Evidence | Level | Status |
|-------|----------|-------|--------|
| Org-scoped finds | repo SQL + `security-isolation.spec.ts` | P3 | VERIFIED |
| Capability deny | gates + `procurement-wave1-security.spec.ts` | P3 | VERIFIED |
| MCP deny-by-default | `mcp-tool-permissions` + tests | P3–P4 | VERIFIED |
| Cross-tenant HTTP e2e | — | P5 | NOT VERIFIED (unit/org mock only) |

## Data

Migration `042` tables/columns + CP `059` permissions. Indexes org-scoped.

## Events / outbox

Catalog entries + use-case `runWithOutbox`. Broker-down unit: three-way enqueue in outbox callback. **PARTIAL:** no dedicated DLQ e2e for procurement.

## Reliability

| Claim | Evidence | Status |
|-------|----------|--------|
| PO ≠ stock | `po-does-not-touch-stock.spec.ts` | VERIFIED |
| expectedVersion CONFLICT | UpdateSupplier mock test | VERIFIED (unit) |
| Idempotency HTTP | global interceptor (platform) | PARTIALLY VERIFIED |
| 3-way SoT MATCHED/MISMATCH | `procurement-three-way.sot.spec.ts` | VERIFIED |
| Multi-vertical same engine | 5-profile capability matrix test | VERIFIED (capability level) |
| Price history append | repo upsert + history table | PARTIALLY VERIFIED (code; no dedicated spec) |
| Accounting AP | — | NOT IN SCOPE |

## Tests run

`pnpm exec vitest run src/modules/purchasing` → **46 passed** (2026-09-12).

## Anti-giant-conditional

Procurement gates use capability sets. Grep-friendly: no `businessType === 'PHARMACY'` in purchasing application/domain for Wave 1 paths. Profile names appear only as **test labels** in `procurement-wave1-security.spec.ts`.

## Honest gaps (Wave 2+)

- AP ledger / payment run / tax engine ownership
- Full Docker HTTP 5-tenant procurement e2e
- Workflow auto-start on every approve path
- Policy rematerialize into org settings SoT
- Edge frontend procurement screens
- Performance soak tests

## Final statement

> Wave 1 delivers a real Procurement Engine extension (supplier depth, RFQ/quotes/award, PO concurrency surface, invoice document + 3-way SoT, landed cost docs, MCP, capabilities) with unit proofs for isolation, multi-vertical capability differentiation, PO≠stock, and SoT matching. It is **not** a complete Accounting AP system and must not be labeled fully Production Ready for the entire master-prompt DoD.
