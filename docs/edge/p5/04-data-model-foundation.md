# P5 — Data Model Foundation

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE** — tables land in migrations **`087`–`089`** (same delivery as module code)

## Migrations (planned)

| Migration | Scope |
|-----------|--------|
| `087_edge_subscriptions_core.sql` | Subscription root, items, periods, status history, lifecycle events |
| `088_edge_subscriptions_entitlements.sql` | Entitlement snapshots, publications, change requests |
| `089_edge_subscriptions_coordination.sql` | Renewals, trials, suspend/cancel, billing + provisioning coordination, policies |

## Tables

| Table | Role |
|-------|------|
| `edge_subscriptions` | Subscription aggregate root (1:1 product) |
| `edge_subscription_items` | Plan / package / add-on lines (commercial composition) |
| `edge_subscription_periods` | Billing/service period boundaries |
| `edge_subscription_status_history` | Append-only status transitions |
| `edge_subscription_lifecycle_events` | Domain lifecycle audit (activate, suspend, …) |
| `edge_entitlement_snapshots` | **Immutable** resolved capability payload per version |
| `edge_entitlement_publications` | Publish / supersede pointer to active snapshot |
| `edge_subscription_change_requests` | Plan/add-on changes + approval state |
| `edge_subscription_renewals` | Renewal terms and outcomes |
| `edge_subscription_trials` | Trial window + conversion metadata |
| `edge_subscription_suspensions` | Suspension reason + window |
| `edge_subscription_cancellations` | Cancel / terminate intent + effective dates |
| `edge_billing_coordination_events` | P6 request/confirm audit (no invoice rows) |
| `edge_provisioning_requests` | P7 request/accept/complete/fail audit |
| `edge_subscription_policies` | Enterprise / activation policy registry |

## Identifiers

- Primary keys: `gen_random_uuid()`
- Subscription numbers: `SUB-######` (sequence TBD in `087`)
- No frontend-supplied technical IDs on create
- Unique idempotent handoff: `(sales_order_id)` or `correlation_id` per active subscription policy

## Immutability

| Artifact | Rule |
|----------|------|
| `edge_entitlement_snapshots` | **Insert-only** — corrections via new snapshot version + publication supersede |
| P4/P2 commercial fields on subscription | Frozen at handoff; changes flow through `change_requests` |
| `edge_subscription_status_history` | Append-only |

## Non-goals in `087`–`089`

- Invoice, payment, tax tables (P6)
- Tenant schema / connection strings (P7)
- Runtime tenant entitlement enforcement tables (downstream runtimes)
