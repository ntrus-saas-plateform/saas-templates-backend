# P4.0 — Architecture Audit (Sales & Commercial Operations)

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED against code unless noted  
**Status:** AUDIT_COMPLETE — CRM foundation may proceed

## Verdict

P4 Sales is **greenfield on Okapi Edge**. No Nest sales/CRM/opportunity/quote module exists under `modules/edge`. Marketing leads (`edge_marketing_leads`) already carry `MARKETING_QUALIFIED` / `SALES_ACCEPTED` statuses but **no sales acceptance inbox or Commercial Account aggregate** exists. Tenant CRM SQL is **out of Edge SoT**.

## Critical boundary: Commercial Account ≠ Tenant

| Concept | Plane | SoT |
|---------|-------|-----|
| Commercial Account | Edge Control Plane (P4) | Sales CRM — commercial relationship |
| Marketing Lead / Prospect org | Edge Control Plane (P3) | Acquisition registry |
| Tenant | Tenant Management | Product+vertical isolated instance |
| Subscription / entitlements | Billing / provisioning domains | Outside P4 |

**Forbidden:** creating tenants from account create, contract execute, or Closed Won alone.

## P0 foundations (REUSE)

| Asset | Path |
|-------|------|
| Edge IAM / JWT / guards | `EdgeAuthGuard`, `RequireEdgePermissions` |
| Edge RBAC | `edge_permissions`, `edge_roles`, `edge_role_assignments` |
| CP outbox | `ControlPlaneOutboxTransactionService` |
| Audit | `edge_audit_events` |
| Edge Console + BFF CSRF | `(edge-console)`, `/api/edge-backend/**` |

## P1 (CONSUME)

| Asset | P4 use |
|-------|--------|
| `edge_products` + commercial availability | Opportunity / offer gates |
| Verticals | Account / opportunity scope |

## P2 (CONSUME — never fork catalog)

| Asset | P4 use |
|-------|--------|
| Plans / packages / add-ons / price books | Offer configurator + quote lines |
| `offer-configurator` + `pricing-math` | Reuse for quote calculation |
| Commercial readiness / publication | Cannot sell unpublished offers |

## P3 (INTEGRATE — do not rewrite)

| Asset | P4 use |
|-------|--------|
| `edge_marketing_leads` + provenance | Sales lead inbox input |
| Lead statuses `MARKETING_QUALIFIED` → `SALES_ACCEPTED` | Bridge signals |
| Marketing consent | Visible on timeline; not sales consent |
| Attribution conversion events | P4 emits conversion signals back |

## Explicit non-reuse

| Asset | Decision |
|-------|----------|
| Tenant CRM / WhatsApp CRM campaigns | Forbidden as Edge sales SoT |
| Second price catalog | Forbidden — P2 only |
| Direct tenant create / entitlement grant | Forbidden |
| Fake e-sign / fake provisioning success | Forbidden |

## Frontend

| Area | Status |
|------|--------|
| Nav Marketing / Commercial | VERIFIED |
| `/edge/sales/**` | **ABSENT** |
| Opportunity workspace | **ABSENT** |

## Conventions

- API: `/api/v1/edge/sales/**`
- Permissions: `platform:sales:*`
- Migration next: **081** after `080_edge_marketing_resend_indexes`
- Hexagonal: `domain/sales` → `application/sales` → `pg-sales.repository` → `sales.controller`
- Events: `sales.*.v1` via CP outbox

## Risks

1. Confusing Commercial Account with Tenant or “Customer” in tenant plane.
2. Closed Won without contract/order controls.
3. Inventing forecast/revenue figures from pipeline alone.
4. Duplicating P2 pricing.
5. Losing P3 marketing provenance on handoff.
