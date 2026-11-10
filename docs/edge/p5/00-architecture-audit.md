# P5.0 � Architecture Audit (Subscription & Entitlement Control)

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED against code unless noted  
**Status:** AUDIT_COMPLETE � subscription foundation may proceed  
**Implementation:** **IMPLEMENTATION_COMPLETE** (docs + migrations `087`+ land in same delivery)

## Verdict

P5 Subscription is **greenfield on Okapi Edge**. No Nest `subscription` / entitlement module exists under `modules/edge`. Latest control-plane migration in tree: **`086_edge_sales_platform_completion`**. Tenant-plane subscription or billing SQL is **out of Edge SoT**.

## Critical boundary (identity)

| Concept | Plane | SoT |
|---------|-------|-----|
| Commercial Account | P4 Sales | Commercial relationship |
| **Subscription** | P5 Edge CP | Sold product commitment + lifecycle |
| **Entitlement snapshot** | P5 Edge CP | Resolved capability view at a point in time |
| Tenant | Tenant Management (P7 downstream) | Product+vertical instance |
| Invoice / payment | P6 Billing | Outside P5 |

**Forbidden in P5:** issuing invoices, collecting payment, provisioning databases, or claiming tenant-active without P7 confirmation.

## P0 foundations (REUSE)

| Asset | Path / note |
|-------|-------------|
| Edge IAM / JWT / guards | `EdgeAuthGuard`, `RequireEdgePermissions` |
| Edge RBAC | `edge_permissions`, `edge_roles`, `edge_role_assignments` |
| CP outbox | `ControlPlaneOutboxTransactionService`, `EDGE_SUBSCRIPTION_OUTBOX_TENANT=edge-control-plane` |
| Audit | `edge_audit_events` |
| Edge Console + BFF CSRF | `(edge-console)`, `/api/edge-backend/**` |

## P1 (CONSUME)

| Asset | P5 use |
|-------|--------|
| `edge_products` + commercial availability | One subscription ? one product |
| Verticals | Subscription scope + console filters |

## P2 (CONSUME � capability inclusions, not runtime entitlements)

| Asset | P5 use |
|-------|--------|
| Plans / packages / add-ons / price books | Commercial composition inputs only |
| Plan/package **capability inclusions** | Resolution inputs � **not** live tenant entitlements |
| Offer configurator / pricing-math snapshots | Idempotent replay from P4 handoff package |
| Commercial publication / readiness | Activation gates reference published commercial |

## P4 (INTEGRATE � handoff consumer)

| Asset | P5 use |
|-------|--------|
| `sales.handoff.requested.v1` / handoff API | Create or resume subscription from dossier |
| Sales order + quote/contract snapshots | Immutable commercial baseline |
| `ProvisioningReference` | Status signals only � P5 does not fulfill |

## Explicit non-reuse

| Asset | Decision |
|-------|----------|
| Tenant billing / subscription tables | Forbidden as Edge SoT |
| P2 live catalog as entitlement truth | Forbidden � snapshots only |
| Fake paid / fake provisioned / fake active tenant | Forbidden |
| Direct tenant or DB create from subscription activate | Forbidden |

## Frontend

| Area | Status |
|------|--------|
| Nav Subscription / Entitlements | **ABSENT** |
| `/edge/subscriptions/**` console | **ABSENT** |

## Staging

**NO-GO** � inherits P0-H (`docs/edge/release/p0-h/`, especially H.8). P5 must not claim `READY_FOR_STAGING` until P0-H clears **and** CP migrations through P5 (`087`�`089`) are applied in target environment.

## Conventions (target)

- API: `/api/v1/edge/subscriptions/**`
- Permissions: `platform:subscriptions:*`
- Migration next: **087** after `086`
- Hexagonal: `domain/subscription` ? `application/subscription` ? `pg-subscription.repository` ? `subscriptions.controller`
- Events: `subscription.*.v1`, `entitlement.*.v1` via CP outbox

## Risks

1. Treating P2 capability inclusions as runtime tenant entitlements.
2. Activating without commercial validation or required provisioning confirmation.
3. Mutating historical entitlement snapshots when catalog changes.
4. Confusing Account, Tenant, Subscription, and Entitlement aggregates.
5. Billing or provisioning adapters returning success without external confirm (P6/P7).
