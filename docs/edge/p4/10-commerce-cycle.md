# P4.4–P4.10 — Commerce Cycle (Activities → Handoff → Forecast)

**Date:** 2026-11-09  
**Status:** IMPLEMENTATION_COMPLETE (domain + API + FE console tabs); requires CP migrations `083`–`085`

## Scope delivered

| Increment | Deliverable |
|-----------|-------------|
| P4.4 | Activities, needs assessments, uncovered-needs gate |
| P4.5 | Offer configurations with P2 configurator snapshot (no catalog fork) |
| P4.6 | Versioned quotes + proposals; issued quotes immutable except via revision |
| P4.7 | Discount policies (matrix-driven), discount requests, commercial approvals (no self-approve) |
| P4.8 | Contracts + signature events; EXECUTED only with provider confirmation |
| P4.9 | Sales orders + idempotent handoff; no direct tenant/subscription create |
| P4.10 | Weighted/pipeline/commit forecasts + performance summary (not recognized revenue) |

## Migrations

- `083_edge_sales_activities_needs.sql`
- `084_edge_sales_quotes_deal_desk.sql`
- `085_edge_sales_contracts_orders_handoff.sql`

## Key API families (`/edge/sales`)

- `activities`, `opportunities/:id/assessments`
- `opportunities/:id/offers`, `quotes`, `quotes/:id/revisions`, `proposals`
- `discount-requests`, `approvals`
- `contracts`, `orders`, `orders/:id/handoff`, `handoffs/:id/provisioning-status`
- `forecast`, `analytics/performance`

## Honesty gates

- OpportunityWon / Closed Won does **not** provision.
- Contract EXECUTED without `signatureProviderConfirmed` is rejected.
- Handoff repeats are idempotent (`correlation_id` + attempt keys).
- Forecast never labeled as recognized revenue.
- P2 prices are snapshotted; P4 does not mutate price books.

## Evidence

- Domain: `domain/sales/sales-commerce.entity.spec.ts`
- Persistence: `pg-sales-commerce.repository.ts`
- Use cases: `application/sales/sales-commerce.use-cases.ts`
- FE: Sales console tabs Activities / Quotes / Deal Desk / Contracts / Orders / Performance
