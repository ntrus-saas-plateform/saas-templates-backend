# P1 — Release Report

## A. Executive Summary

P1 delivers an **additive** Product Catalog & Portfolio Governance foundation on Okapi Edge Control Plane:

- Migration `074_edge_product_catalog.sql`
- Domain + APIs for products, versions, market segments, profiles, operating models, capabilities, backends, contracts, readiness, publication
- Extended vertical lifecycle (DEPRECATED / RETIRED / ARCHIVED) + lifecycle events
- Edge Console UI: portfolio, catalog, markets, readiness, vertical products

**Not delivered as full P2–P9:** pricing, plans, CRM, subscriptions, billing, entitlements, tenant provisioning.

**P0-H:** H.1–H.4 PASS; H.5–H.6 PARTIAL; H.7 NOT_EXECUTED; H.8 **NO-GO** — see `docs/edge/release/p0-h/acceptance-matrix.md`.

**Recommendation:** **READY_FOR_REVIEW** (engineering review of catalog foundation). **NOT READY_FOR_STAGING** (P0-H formal NO-GO).

## B. Architecture

- Bounded contexts under `src/modules/edge/domain/{product,market,capability,backend,contract,readiness,publication}`
- Reuses P0 Edge IAM, `@EdgeRoute`, workspace sessions, `edge_audit_events` patterns
- ADRs: `docs/edge/p1/03-architecture-decisions.md`

## C–E. Backend / Frontend / Data

See implementation under:

- Backend: `074_*.sql`, edge module product/catalog controllers
- Frontend: `/edge/catalog`, `/edge/markets`, `/edge/readiness`, portfolio overview
- Data: Control Plane only; no tenant `edge_*` product tables

## F. Testing (executed)

| Control | Command | Status |
|---------|---------|--------|
| Backend typecheck | `pnpm typecheck` | **PASS** |
| Edge domain + product authz unit | `vitest run …/edge/domain/product …/application/product …` | **PASS** (32) |
| Catalog DB (TC) | `TESTCONTAINERS=true … edge-catalog-db.spec.ts` | **PASS** (2/2, 2026-11-09) |
| Frontend unit | `pnpm test` (edge-frontend) | **PASS** (24) |
| Cross-vertical product isolation (unit) | product.use-cases.spec + product-vertical-access.spec | **PASS** |
| Full HTTP authz matrix (10 personas) | Keycloak fixture harness | **NOT_EXECUTED** |
| Playwright catalog E2E authenticated A–E | — | **NOT_EXECUTED** |
| P0-H overall | `docs/edge/release/p0-h/acceptance-matrix.md` | **NO-GO** (H.1–H.4 PASS; H.5–H.6 partial; H.7–H.8 open) |

## G. Remaining work

- Full HTTP authorization matrix with Edge Keycloak fixtures
- Authenticated Playwright scenarios A–E from P1 spec
- Capability evidence UI / readiness profile admin screens
- Outbox domain events for catalog publication consumers
- P0-H.2–H.8 gates before any staging claim

## I. Release recommendation

**READY_FOR_REVIEW**
