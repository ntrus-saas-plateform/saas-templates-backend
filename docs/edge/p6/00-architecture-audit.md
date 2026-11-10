# P6.0 � Architecture Audit (Billing & Payments)

**Date:** 2026-11-09  
**Repos:** `saas-templates-backend`, `saas-template-frontend`  
**Evidence class:** VERIFIED against code unless noted  
**Status:** AUDIT_COMPLETE � billing foundation may proceed  
**Implementation:** **IMPLEMENTATION_COMPLETE** (docs + migrations `090`+ land in same delivery)

## Verdict

P6 Billing is **greenfield on Okapi Edge**. No Nest `billing` / invoice / payment module exists under `modules/edge`. Latest control-plane migration in tree: **`089_edge_subscriptions_coordination`** (P5). **Tenant-plane `commercial_*` / legacy billing tables are NOT Edge SoT.**

## Critical boundary

| Concept | Plane | SoT |
|---------|-------|-----|
| Commercial Account | P4 Sales | Commercial relationship |
| Subscription lifecycle | P5 Edge CP | Sold product commitment + status |
| **Billing account** | P6 Edge CP | Bill-to / profile linkage to subscription |
| **Invoice** | P6 Edge CP | Issued charges (immutable when issued) |
| **Payment** | P6 Edge CP | Money collection state (never faked) |
| Entitlement / tenant | P5 / P7 | P6 does not own |

**Forbidden in P6:** mutating P5 subscription status directly, marking invoice `PAID` without provider proof or verified webhook, storing PAN/CVV, using Hyperswitch as a dependency.

## P0 foundations (REUSE)

| Asset | Path / note |
|-------|-------------|
| Edge IAM / JWT / guards | `EdgeAuthGuard`, `RequireEdgePermissions` |
| Edge RBAC | `edge_permissions`, `edge_roles`, `edge_role_assignments` |
| CP outbox | `ControlPlaneOutboxTransactionService`, `EDGE_BILLING_OUTBOX_TENANT=edge-control-plane` |
| Audit | `edge_audit_events` |
| P5 coordination pattern | `edge_billing_coordination_events` � P6 is consumer/producer of coordination |

## P5 (INTEGRATE)

| Asset | P6 use |
|-------|--------|
| `subscription.billing_coordination.requested.v1` | Create/update billing profile, schedule, first invoice intent |
| Subscription refs | `subscription_id`, commercial snapshot refs � read-only from P5 |
| Billing gate confirm | Emit `billingConfirmed` only after real financial path |

## Explicit non-reuse

| Asset | Decision |
|-------|----------|
| Tenant `commercial_*` billing tables | Forbidden as Edge SoT |
| Hyperswitch / embedded PSP SDK | **Not used** � pluggable adapter port only |
| Fake `PAID` / synthetic provider refs | Forbidden |
| PAN, CVV, full track data | Forbidden � token refs only via future adapter |

## Payment provider (design lock)

| Item | Decision |
|------|----------|
| Integration style | **Pluggable adapter** (hexagonal port) |
| Default runtime | `UNAVAILABLE` � honest 503 / domain state |
| Env | `BILLING_PAYMENT_ADAPTER=unavailable\|http_webhook\|auto` |
| Hyperswitch | **NOT** in scope or dependencies |

## Frontend

| Area | Status |
|------|--------|
| Nav Billing / Invoices | **ABSENT** |
| `/edge/billing/**` console | **ABSENT** |

## Staging

**NO-GO** � inherits P0-H and P5 readiness. P6 must not claim `READY_FOR_STAGING` until CP migrations through P6 (`090`�`092`) are applied and adapter mode is explicitly configured.

## Conventions (target)

- API: `/api/v1/edge/billing/**`
- Permissions: `platform:billing:*`
- Migration next: **090** after `089`
- Hexagonal: `domain/billing` ? `application/billing` ? repositories ? `billing.controller`
- Events: `billing.*.v1` via CP outbox
- Money: decimal strings (e.g. `"199.00"`) + ISO 4217 currency code

## Risks

1. Confirming P5 `billingConfirmed` before payment or credit path is real.
2. Treating tenant commercial tables as billing truth.
3. Issuing invoice line edits after `ISSUED` (immutability breach).
4. Assuming `http_webhook` adapter is secure without signature verification.
5. Collapsing invoice status and payment status into one boolean.
