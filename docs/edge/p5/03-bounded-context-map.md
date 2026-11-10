# P5 — Bounded Context Map

**Date:** 2026-11-09  
**Implementation:** **IMPLEMENTATION_COMPLETE**

| # | Context | Responsibility | Aggregate root(s) | Upstream | Downstream |
|---|---------|----------------|-------------------|----------|------------|
| 1 | **Subscription Core** | Registry, identity, account/product refs, search | Subscription | P4 handoff, P1 product | Console, analytics |
| 2 | **Lifecycle** | Status machine, activation gates, history | Subscription (status) | Core | Coordination, Entitlements |
| 3 | **Composition** | Plan, package, add-ons, commercial period boundaries | SubscriptionItem, SubscriptionPeriod | P2 snapshots | Entitlements, Billing |
| 4 | **Entitlements** | Resolve, snapshot, publish, reconcile reads | EntitlementSnapshot, EntitlementPublication | P2 inclusions, Composition | P6/P7 consumers (read) |
| 5 | **Changes** | Plan changes, add-on churn, approvals | SubscriptionChangeRequest | Composition, Governance | Lifecycle, Entitlements |
| 6 | **Renewals** | Term renewal, extension windows | SubscriptionRenewal | Composition | Billing coord (P6) |
| 7 | **Trials** | Trial start/end, conversion gates | SubscriptionTrial | Composition | Lifecycle |
| 8 | **Coordination — Billing** | Request billing setup, confirm external state | BillingCoordinationEvent | Lifecycle | **P6 port** |
| 9 | **Coordination — Provisioning** | Request provision, track accept/complete/fail | ProvisioningRequest | Lifecycle | **P7 port** |
| 10 | **Governance / Analytics** | Policies, enterprise rules, honest metrics | SubscriptionPolicy, read models | P0 audit | Console |

## Upstream (consume, do not fork)

| Phase | Provides |
|-------|----------|
| **P4** | Handoff dossier, sales order, quote/contract snapshots, correlation id |
| **P2** | Commercial structure + capability **inclusions** (catalog-time, snapshotted) |
| **P1** | Product id, vertical scope, commercial availability |

## Downstream (ports only in P5.0)

| Phase | Port contract |
|-------|---------------|
| **P6** | Billing coordination — subscription billing profile, invoice triggers (no implementation in P5) |
| **P7** | Provisioning — tenant create/bind, completion/failure callbacks |

## Anti-corruption

- P4 commercial snapshots are copied at handoff; live P2/P4 changes do not mutate active subscription composition without an explicit change request.
- Marketing or sales timeline events remain in P3/P4 provenance — P5 emits `subscription.*` / `entitlement.*` only.
