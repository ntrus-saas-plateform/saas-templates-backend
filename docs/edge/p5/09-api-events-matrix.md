# P5 — API & Events Matrix

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**  
**Base path:** `/edge/subscriptions` (Edge auth + permission guards)  
**Outbox tenant:** `EDGE_SUBSCRIPTION_OUTBOX_TENANT=edge-control-plane`

## API families

| Family | Methods | Permissions |
|--------|---------|-------------|
| overview / analytics | GET | `read_analytics` |
| subscriptions | GET/POST/PUT | `read` / `create` / `update` |
| from-handoff | POST | `create` |
| lifecycle | submit/approve/activate/suspend/reactivate/cancel/terminate | matching `*` lifecycle perms |
| composition | items / periods | `update`, `manage_addons`, `change_plan` |
| trials | start/extend/convert | `manage_trials` |
| renewals | propose/confirm | `renew` |
| change-requests | GET/POST/decide | `change_plan`, `manage_approvals` |
| entitlements | GET snapshots / effective / publish | `read_entitlements`, `publish_entitlements` |
| reconcile | POST | `reconcile_entitlements` |
| policies / enterprise | GET/POST | `manage_policies`, `read_enterprise`, `manage_enterprise` |
| billing-coordination | GET/POST status | `read`, `manage_integrations` |
| provisioning-coordination | GET/POST status | `read`, `manage_integrations` |
| integrations | configure P6/P7 endpoints | `manage_integrations` |

Exact routes land with module code in the same delivery as migrations `087`+.

## Domain events (outbox)

| Event type | Aggregate |
|------------|-----------|
| `subscription.created.v1` | SUBSCRIPTION |
| `subscription.updated.v1` | SUBSCRIPTION |
| `subscription.handoff.consumed.v1` | SUBSCRIPTION |
| `subscription.activation.requested.v1` | SUBSCRIPTION |
| `subscription.activated.v1` | SUBSCRIPTION |
| `subscription.activation.failed.v1` | SUBSCRIPTION |
| `subscription.suspended.v1` | SUBSCRIPTION |
| `subscription.reactivated.v1` | SUBSCRIPTION |
| `subscription.cancelled.v1` | SUBSCRIPTION |
| `subscription.expired.v1` | SUBSCRIPTION |
| `subscription.terminated.v1` | SUBSCRIPTION |
| `subscription.renewal.requested.v1` | SUBSCRIPTION_RENEWAL |
| `subscription.renewal.confirmed.v1` | SUBSCRIPTION_RENEWAL |
| `subscription.change.requested.v1` | SUBSCRIPTION_CHANGE |
| `subscription.change.approved.v1` | SUBSCRIPTION_CHANGE |
| `subscription.trial.started.v1` / `subscription.trial.ended.v1` | SUBSCRIPTION_TRIAL |
| `billing.coordination.requested.v1` | BILLING_COORDINATION |
| `billing.coordination.confirmed.v1` | BILLING_COORDINATION |
| `provisioning.requested.v1` | PROVISIONING_REQUEST |
| `provisioning.accepted.v1` | PROVISIONING_REQUEST |
| `provisioning.completed.v1` / `provisioning.failed.v1` | PROVISIONING_REQUEST |
| `entitlement.snapshot.created.v1` | ENTITLEMENT_SNAPSHOT |
| `entitlement.published.v1` | ENTITLEMENT_PUBLICATION |
| `entitlement.reconciled.v1` | ENTITLEMENT (read model) |

## Consumed events (inbound)

| Event | Handler |
|-------|---------|
| `sales.handoff.requested.v1` | Create or resume draft subscription |

## Security notes

- Activation and publish endpoints **re-check gates server-side**; client flags ignored.
- Adapter configure endpoints never return stored secrets in API responses.
- Vertical scope enforced on read/list for `VERTICAL_*` roles.
