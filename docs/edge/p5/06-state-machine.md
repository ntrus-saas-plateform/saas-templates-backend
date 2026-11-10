# P5 — Subscription State Machine

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Statuses

`DRAFT` ? `PENDING_APPROVAL` ? `PENDING_ACTIVATION` ? **`ACTIVE`**  
Branches: **`SUSPENDED`**, **`CANCELLED`**, **`EXPIRED`**, **`TERMINATED`**, **`FAILED_ACTIVATION`**

| Status | Meaning |
|--------|---------|
| `DRAFT` | Created; composition editable |
| `PENDING_APPROVAL` | Enterprise / change policy queue |
| `PENDING_ACTIVATION` | Gates in flight (commercial + optional provision + billing coord) |
| `ACTIVE` | Serving period; entitlements published |
| `SUSPENDED` | Temporarily inactive; entitlements may be frozen per policy |
| `CANCELLED` | Cancel scheduled or at period end |
| `EXPIRED` | Natural term end without renewal |
| `TERMINATED` | Hard end; no further activation |
| `FAILED_ACTIVATION` | Gates failed; correctable or terminal |

## Allowed transitions

| From | To | Guard (summary) |
|------|-----|-----------------|
| `DRAFT` | `PENDING_APPROVAL` | Submit when policy requires approval |
| `DRAFT` | `PENDING_ACTIVATION` | Submit when no approval required |
| `PENDING_APPROVAL` | `DRAFT` | Reject / withdraw |
| `PENDING_APPROVAL` | `PENDING_ACTIVATION` | Approved |
| `PENDING_ACTIVATION` | `ACTIVE` | All activation gates pass |
| `PENDING_ACTIVATION` | `FAILED_ACTIVATION` | Gate failed or timed out |
| `FAILED_ACTIVATION` | `DRAFT` | Operator reset (audited) |
| `FAILED_ACTIVATION` | `TERMINATED` | Abandon |
| `ACTIVE` | `SUSPENDED` | Suspend permission + reason |
| `SUSPENDED` | `ACTIVE` | Reactivate permission |
| `ACTIVE` | `CANCELLED` | Cancel permission |
| `SUSPENDED` | `CANCELLED` | Cancel while suspended |
| `ACTIVE` | `EXPIRED` | Period end (system) |
| `CANCELLED` | `EXPIRED` | Effective cancel date reached |
| `*` (non-terminal) | `TERMINATED` | Terminate permission (audited) |

Illegal transitions are rejected in domain; every change appends `edge_subscription_status_history`.

## Activation gates

| Gate | Required when | Pass condition |
|------|---------------|----------------|
| **Commercial validation** | Always | Handoff / snapshot replay matches product, currency, composition; P2 publication rules satisfied |
| **Approval** | Policy / enterprise | `APPROVED` decision on record |
| **Billing coordination (P6)** | Product policy | `CONFIRMED` or explicit waive — **never** `PAID` without P6 |
| **Provisioning confirmation (P7)** | Product requires tenant | `COMPLETE` from P7 — **never** fake `TENANT_ACTIVE` |

If provisioning adapter is **UNAVAILABLE** and policy mandates provision ? remain `PENDING_ACTIVATION` or ? `FAILED_ACTIVATION` (configurable policy; default: do not activate).

## Events (examples)

| Transition | Event |
|------------|-------|
| ? `PENDING_ACTIVATION` | `subscription.activation.requested.v1` |
| ? `ACTIVE` | `subscription.activated.v1` |
| ? `SUSPENDED` | `subscription.suspended.v1` |
| ? `CANCELLED` | `subscription.cancelled.v1` |
| ? `TERMINATED` | `subscription.terminated.v1` |
| ? `FAILED_ACTIVATION` | `subscription.activation.failed.v1` |
