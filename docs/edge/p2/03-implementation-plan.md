# P2 — Implementation Plan

## Increment 1 (this delivery)

1. Migration `075_edge_commercial_foundation.sql`
2. Domain entities + pricing decimal helpers + ownership invariants
3. Repositories + use cases for markets, ICP, packages, plans, add-ons, price books, commercial readiness/publication
4. Edge APIs under `/api/v1/edge/commercial/**`
5. Console UI: `/edge/commercial` hub + markets / plans / pricing pages
6. Unit tests: plan product ownership, capability inclusion gates, pricing math
7. Docs 00–04 + condensed domain docs + release report honesty

## Increment 2 (in progress)

Done in this pass:
- Offer configurator domain + API (`POST .../offers/configure`)
- Commercial outbox events on readiness evaluate + plan publish
- Configurator / events docs

Still open:
- Full research provenance UI
- Persona / buying committee / value proposition builders
- Offer configurator explainability UI polish
- Discount approval workflow UI
- Authenticated Playwright commercial scenarios A–F
- Remaining domain docs 03–23 stubs

## Dependencies

- P1 product/capability APIs must remain available
- P0-H NO-GO does not block P2 development; blocks staging claim
