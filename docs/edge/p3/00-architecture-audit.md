# P3.0 — Architecture Audit (Marketing & Acquisition)

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED against code unless noted  
**Status:** AUDIT_COMPLETE — foundation implementation may proceed

## Verdict

P3 marketing is **greenfield on Okapi Edge**. No Edge Nest marketing/campaign/lead module exists. Tenant CRM/campaign SQL (`migrations/tenant/043_crm_*`) is **out of Edge SoT** and must not be reused as Edge acquisition.

## P0 foundations (reuse)

| Asset | Status | Path |
|-------|--------|------|
| Edge IAM / Keycloak edge-admin | VERIFIED | Edge JWT + `EdgeAuthGuard` |
| Workspace switching | VERIFIED | `edge_workspace_sessions`, workspace guards |
| Vertical memberships | VERIFIED | `073_edge_foundation.sql` |
| Edge RBAC + `RequireEdgePermissions` | VERIFIED | `edge_permissions`, `EdgePermissionGuard` |
| Audit | VERIFIED | `edge_audit_events` |
| CP outbox | VERIFIED | `021_control_plane_outbox.sql`, `ControlPlaneOutboxTransactionService` |
| Edge Console + BFF CSRF | VERIFIED | `(edge-console)`, `okapi_edge_csrf` |
| P0-H staging | **NO-GO** (H.8) | Do not claim READY_FOR_STAGING |

## P1 foundations (consume, never rewrite)

| Asset | Use in P3 |
|-------|-----------|
| `edge_products` + commercial_availability | Hard gate for campaign publish |
| Verticals | Campaign / audience scope |
| Market segments (taxonomy) | Audience targeting refs |
| Product readiness / publication | Campaign must not promote unpublished products when policy requires |

## P2 foundations (reference, never fork)

| Asset | Use in P3 |
|-------|-----------|
| Commercial markets / ICPs / personas | Audience + campaign targeting FKs |
| Plans / packages / add-ons / enterprise templates | Offer association on campaigns & landing pages |
| Commercial readiness / publication | Content consistency checks vs published offers |
| `commercial.*` outbox events | Downstream consumers; P3 publishes `marketing.*` |

## Explicit non-reuse

| Asset | Decision |
|-------|----------|
| Tenant CRM engine / WhatsApp campaigns | **Forbidden** as Edge marketing SoT |
| ERP commerce permissions (041+) | Tenant plane — out of P3 |
| Identity push notifications | Staff/user notifications — not acquisition channels |
| OpenAPI `purpose: MARKETING` consent enum | ERP consumer consent — separate from Edge lead consent |

## Frontend

| Area | Status |
|------|--------|
| Edge nav | VERIFIED — no Marketing entry |
| `/edge/marketing/**` | **ABSENT** |
| Commercial hub | VERIFIED — P2 ops only |
| Public lead capture BFF | **ABSENT** — Edge BFF requires session; need dedicated public proxy |

## Routing & conventions to follow

- API: `/api/v1/edge/marketing/**`
- Permissions: `platform:marketing:*` (match commercial naming)
- Migration next: **077** after `076_edge_commercial_governance_extensions`
- Hexagonal: `domain/marketing` → `application/marketing` → `pg-marketing.repository` → `marketing.controller`
- Events: `marketing.*.v1` via CP outbox + sentinel `edge-control-plane`

## Risks

1. Public form capture must not create tenants/subscriptions.
2. Do not invent impressions/clicks/CAC when sources absent.
3. Do not couple channel orchestration to a single ESP vendor.
4. Consent must be explicit + timestamped — never inferred from page views.
5. Tenant CRM must remain isolated from Edge prospect registry.
