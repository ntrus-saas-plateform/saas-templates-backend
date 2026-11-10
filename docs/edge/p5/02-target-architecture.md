# P5 — Target Architecture

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

## Placement

P5 lives in the **SaaS Control Plane** (Okapi Edge) only. Hexagonal Nest subdomain `subscription` under `modules/edge`. **One subscription = one product** (no multi-product subscription root in P5.0).

```
P4 Handoff (order + commercial snapshots)
              ¦
              ?
     Subscription Draft / Composition
              ¦
              +-? Commercial validation (P2 snapshot replay)
              ¦
              +-? Billing coordination --? P6 port (request/confirm)
              ¦         UNAVAILABLE until configured
              ¦
              +-? Provisioning coordination --? P7 port (request/accept/complete/fail)
              ¦         UNAVAILABLE until configured
              ¦
              ?
     Active subscription + entitlement publication
              ¦
              ?
     entitlement.*.v1 (snapshot, not live tenant ACL)
```

## Identity model (never collapse)

| Term | Meaning in P5 |
|------|----------------|
| **Account** | P4 commercial account — billing relationship context |
| **Tenant** | Downstream product instance — P5 stores refs only |
| **Subscription** | CP aggregate: sold product + lifecycle + composition |
| **Entitlement** | Resolved capability view (snapshot) for a subscription period |
| **Invoice** | P6 artifact — **P5 never creates** |

## Invariants (always)

- Backend-generated UUIDs only.
- Status transitions enforced in domain (see `06-state-machine.md`).
- Handoff consumption idempotent on `correlation_id` / sales order.
- Activation requires commercial validation; provisioning confirmation when policy requires.
- Entitlement snapshots **immutable** after publish; catalog drift does not rewrite history.
- P5 **never** invoices, charges, or provisions databases.

## Adapters (honest defaults)

| Port | P5 behavior until P6/P7 wired |
|------|-------------------------------|
| Billing coordination | Returns `UNAVAILABLE` or explicit `PENDING_EXTERNAL`; **no fake `PAID`** |
| Provisioning coordination | Returns `UNAVAILABLE` or `PENDING`; **no fake `TENANT_ACTIVE`** |

## Event bus

`subscription.*.v1` and `entitlement.*.v1` via CP outbox tenant `edge-control-plane`; consumers idempotent; correlation id required on handoff and coordination.
