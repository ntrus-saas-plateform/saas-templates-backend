# P4 — Qualification Report

**Date:** 2026-11-09  
**Verdict:** **IMPLEMENTATION_COMPLETE / RUNTIME_PENDING_MIGRATE**  
**Production staging:** **NO-GO** until CP migrations `081`–`086` applied and P0-H staging gates cleared.

## Exit criteria checklist (§30)

| Criterion | Evidence | Status |
|-----------|----------|--------|
| P3 leads integrated with provenance | `marketing-lead-qualified.handler` + `edge_sales_leads.marketing_lead_id` | PASS (unit) |
| CRM accounts/contacts/teams | `081` + sales UCs + FE tabs | PASS (code) |
| Lead accept/qualify/convert | lead UCs + opportunity create from lead | PASS (code) |
| Opportunity lifecycle + governed pipeline | `082` + transition rules + Closed Won gates | PASS (unit+code) |
| Activities + needs assessment | `083` + UCs | PASS (code) |
| Offers from P2 configurator | `configureCommercialOffer` snapshot on offer cfg | PASS (code) |
| Versioned quotes / proposals | `084` + revise creates version | PASS (code) |
| Discount governance | matrix-driven levels + no self-approve | PASS (unit) |
| Contracts traceable; EXECUTED gated | resolving signature + governed manual path | PASS (unit+code) |
| Orders + handoff; no direct tenant | handoff package + provisioning confirm | PASS (code) |
| Forecast ≠ recognized revenue | assert + disclaimer | PASS (unit) |
| Permissions + audit/outbox | `081` grants + outbox events | PASS (code) |
| Security / integrity unit tests | sales + sales-commerce + signature/calendar adapters | PASS |
| Authenticated E2E / Playwright | scenarios A–F shipped; auth gated on secrets | PASS (code) / PENDING (secrets) |
| Staging qualification | blocked by migrate + P0-H | PENDING |

## Adversarial controls verified in code

1. Client cannot pass `quoteAccepted` / `contractExecuted` to forge Closed Won.
2. Self-approval of discounts/approvals rejected.
3. Issued quotes not mutated in place (revision path only).
4. Signature adapter UNAVAILABLE never invents confirmation; live adapters confirm only on provider completed.
5. Handoff idempotent on correlation / active order.
6. Provisioning fulfilled claim without confirmation rejected.

## Command evidence

```text
npm run test:edge:sales
npm run check:sales:migrations   # after migrate:control
cd saas-template-frontend && npm run test:e2e:sales
```

## Migrations required before runtime smoke

1. `081_edge_sales_crm_foundation.sql`
2. `082_edge_sales_opportunity_pipeline.sql`
3. `083_edge_sales_activities_needs.sql`
4. `084_edge_sales_quotes_deal_desk.sql`
5. `085_edge_sales_contracts_orders_handoff.sql`
6. `086_edge_sales_platform_completion.sql`

Apply: `npm run migrate:control` then `npm run check:sales:migrations`.
