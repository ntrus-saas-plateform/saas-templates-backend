# P4 — Release Status & Remaining Limits

**Date:** 2026-11-09  
**Increments:** P4.0 → P4.10 (CRM through Forecast) + Sales Console integration  
**Status:** IMPLEMENTATION_COMPLETE (unit-tested domain); DB migrations `081`–`085` required for runtime

## Delivered

- P4.0 audit + reuse/build/extend + architecture + bounded context map
- Migrations `081`–`085` (CRM, pipeline, activities/needs, quotes/deal desk, contracts/orders/handoff)
- Domain invariants (account ≠ tenant, merge, lead transitions, closed-won gates, quote immutability, discount matrix, contract EXECUTED gate, handoff completeness, no fake provisioning)
- Nest hexagonal sales + sales-commerce modules
- Edge Sales console (`/edge/sales`) — CRM, pipeline, activities, quotes, deal desk, contracts, orders, performance
- Outbox events for account/contact/lead/opportunity/quote/discount/contract/order/handoff lifecycle
- Docs: data model, permissions, API/events/P3 bridge, opportunity/pipeline, commerce cycle

## Explicit remaining limits (honest)

| Area | Status |
|------|--------|
| Real e-sign provider adapter | Adapter port pattern ready; no live DocuSign/HelloSign wired |
| PDF proposal generation | Structure/versioning yes; binary PDF render deferred |
| Calendar / visioconférence sync | Activity model only; external calendar adapter not configured |
| Full Playwright sales suite | After CP migrate on staging |
| Opportunity Workspace deep FE | Console tabs present; dedicated workspace page polish deferred |
| Visibility scopes (rep vs manager vs legal) | RBAC permissions enforced; row-level ownership filters PARTIAL |
| Staging readiness | Still gated by P0-H if unchanged |

## Honesty gates

- Do not claim Closed Won / provisioning / revenue without contract+order+handoff confirmation path.
- Forecast / pipeline values are **projections**, not recognized revenue.
- Staging readiness still blocked by P0-H if unchanged.

## Evidence

- Unit: `domain/sales/sales.entity.spec.ts`, `domain/sales/sales-commerce.entity.spec.ts`
- Code: `modules/edge/**/sales*`
- FE: `app/(edge-console)/edge/sales/page.tsx`
- Docs: `docs/edge/p4/*`
