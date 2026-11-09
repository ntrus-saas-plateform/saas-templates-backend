# P2 Release report — Increment 1

**Status:** `READY_FOR_REVIEW` (not staging)  
**Date:** 2026-03-09  
**Scope:** P2 commercial foundation complete enough for review; see `31-completeness-matrix.md`

## Executive summary
P2 Increment 1 delivers the Control Plane commercial foundation on top of delivered P0/P1: markets, ICPs, solution packages, plans, add-ons, pricing units/price books, decimal pricing preview, commercial readiness evaluation, and plan publication snapshots. Technical capabilities remain owned by P1; commercial inclusion never mutates P1 readiness.

## Evidence

| Gate | Status | Evidence |
|------|--------|----------|
| Architecture docs 00–04 | PASS | `docs/edge/p2/00`–`04` |
| Migration 075 present | PASS | `migrations/control-plane/075_edge_commercial_foundation.sql` |
| Domain unit tests | PASS | commercial domain + use-cases — 25 passed |
| Migration 076 governance extensions | PASS | Testcontainers commercial DB |
| Completeness matrix | PASS | `docs/edge/p2/31-completeness-matrix.md` |
| Backend typecheck | PASS | `tsc --noEmit` exit 0 |
| Commercial APIs wired | PASS | `EdgeCommercialController` + providers + persistence |
| Edge Console commercial hub | PASS | `/edge/commercial`, plan detail readiness/publish |
| Fake prices / TAM seeded | NOT_APPLICABLE | Explicitly absent |
| Full docs 03–29 domain set | PARTIAL | API + data model + this report; remaining domain docs Increment 2 |
| Offer configurator engine | PASS | Domain + API + unit tests |
| Catalog projections | PASS | `GET /commercial/catalog?view=` |
| Tiered/volume pricing | PASS | pricing-math unit tests |
| Outbox commercial events | PASS | market/icp/segment/package/pricebook/offer via CP outbox |
| Playwright commercial smoke | PASS | `e2e/edge-commercial-smoke.spec.ts` — 3 passed (auth gate + CSRF) |
| Playwright A–F CSRF contract | PASS | `e2e/edge-commercial-scenarios.spec.ts` — six mutation paths |
| Domain/DB scenarios A–F | PASS | `test/integration/edge-commercial-scenarios.spec.ts` (Testcontainers) |
| Playwright scenarios A–F (authenticated full UI) | NOT_EXECUTED | Requires `EDGE_E2E_AUTH=1` + Edge Keycloak fixture |
| Migration clean apply 075 | PASS | `edge-commercial-db.spec.ts` Testcontainers — 2 passed |
| Migration ordering 075 after 074 | PASS | qualification + commercial DB specs updated |
| READY_FOR_STAGING | BLOCKED | Authenticated A–F + P0-H remaining items |

## Architecture
- NestJS modular monolith, Edge BC, hexagonal ports
- Commercial persistence: `PgCommercialRepository`
- Money: bigint fixed-scale math (`pricing-math.ts`) — no IEEE floats

## Security
- Permissions seeded in 075 and attached to global commercial roles per migration
- Server-side `RequireEdgePermissions` on every commercial route
- Vertical isolation of product ownership enforced in use cases

## Known issues / remaining work
1. Research project / segment scoring / buying committee dedicated APIs still thin.
2. Authenticated Playwright UI A–F not yet executed (CSRF + domain/DB A–F covered).
3. Full docs set 03–29 not complete (core docs present; remaining stubs).
4. Discount approval request workflow (vs policy registry) deferred to P4/P5 consumers.

## Recommendation
**Do not promote to staging.** Status remains `READY_FOR_REVIEW`.
