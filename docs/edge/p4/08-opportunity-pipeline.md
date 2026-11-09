# P4.3 — Opportunity & Pipeline

**Migration:** `082_edge_sales_opportunity_pipeline.sql`

## Default pipeline stages

New Opportunity → Discovery → Needs Assessment → Solution Design → Proposal Preparation → Proposal Sent → Negotiation → Verbal Agreement → Contract Review → Closed Won | Closed Lost

Transitions are explicit rows in `edge_sales_pipeline_transitions`. Arbitrary jumps are rejected.

## Closed Won gates (domain)

- Commercial account present
- Positive estimated value
- Product reference present
- Optional later: accepted quote / executed contract when `requireQuote` / `requireContract` flags are set

`sales.opportunity.won.v1` **does not** trigger provisioning.

## Closed Lost

Requires documented `lossReasonCode` from controlled set (`PRICE`, `COMPETITOR`, …, `OTHER` + text).

## APIs

- `GET /sales/pipelines`
- `GET /sales/pipeline/board`
- `GET|POST /sales/opportunities`
- `GET|PUT /sales/opportunities/:id`
- `POST /sales/opportunities/:id/stages`
- `POST /sales/opportunities/:id/close`
- `POST /sales/opportunities/:id/reopen`
- `POST /sales/opportunities/:id/risks|competitors|contacts`

## Console

`/edge/sales` tabs: Opportunities + Pipeline (Kanban columns from board API).
