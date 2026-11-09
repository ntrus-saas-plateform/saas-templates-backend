# P2.0 — Architecture Audit

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED against code unless noted

## P0 foundations (reusable)

| Asset | Status | Path |
|-------|--------|------|
| Edge IAM / `edge-admin` realm | VERIFIED | `docker/keycloak/edge-admin-realm.json`, Edge JWT validators |
| Workspace sessions | VERIFIED | `edge_workspace_sessions`, `EdgeWorkspaceGuard` |
| Vertical registry + memberships | VERIFIED | `073_edge_foundation.sql` |
| Edge RBAC | VERIFIED | `edge_permissions` / roles / assignments |
| Edge Admin Console + BFF cookies | VERIFIED | `(edge-console)`, `okapi_edge_*` |
| Audit | VERIFIED | `edge_audit_events` |
| P0-H | H.1–H.4 PASS; H.5–H.6 partial; H.7 NOT_EXECUTED; **H.8 NO-GO** | `docs/edge/release/p0-h/` |

## P1 foundations (consumable SoT)

| Asset | Status | Notes |
|-------|--------|-------|
| Migration | VERIFIED | `074_edge_product_catalog.sql` |
| Products / versions | VERIFIED | `edge_products`, `edge_product_versions` |
| Market segments (taxonomy) | VERIFIED | `edge_market_segments` — **structural taxonomy only** |
| Business profile templates | VERIFIED | Reference models, not CRM prospects |
| Operating models | VERIFIED | Shared taxonomy |
| Technical capabilities + mappings | VERIFIED | Must be consumed, never rewritten by P2 |
| Product readiness / publication | VERIFIED | Technical gate — separate from commercial readiness |
| APIs | VERIFIED | `/api/v1/edge/products/**`, market-segments, capabilities, … |
| UI | VERIFIED | `/edge/catalog`, `/edge/markets`, `/edge/readiness` |
| Gaps | DOCUMENTED | Full HTTP authz matrix + authenticated catalog E2E NOT_EXECUTED |

## Existing non-Edge commercial artifacts

| Asset | Decision |
|-------|----------|
| ERP tenant plan modules (`028`, `041` commerce permissions) | **Do not** merge into Edge commercial catalog |
| ERP pricing / price lists (event catalog) | Tenant/data-plane — **out of P2 SoT** |
| Metrics `commercial_pricing_latency_seconds` | ERP observability — not Edge Price Books |

## Frontend

| Area | Status |
|------|--------|
| Edge nav | VERIFIED — Portfolio / Catalog / Markets / Readiness |
| Commercial workspace UI | **ABSENT** — create under `/edge/commercial/**` |
| Design system / permission gates | Reuse |

## Reuse / extend / create

| Decision | Items |
|----------|-------|
| **Reuse** | Edge guards, vertical scope, product FKs, capability registry, audit |
| **Extend** | Permission seeds; nav; vertical workspace commercial views |
| **Create** | Market intelligence, ICP, personas, packages, plans, add-ons, pricing, price books, commercial readiness/publication |
| **Forbidden** | Second product catalog; tenant multi-product; entitlement engine; billing |

## Risks

1. P1 commercial_availability must remain hard gate for promised capabilities.
2. Money must use decimal/numeric — never JS float.
3. Do not invent TAM/SAM/SOM or list prices.
4. P0-H NO-GO: P2 must not claim READY_FOR_STAGING.
