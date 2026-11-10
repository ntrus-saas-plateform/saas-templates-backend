# 02 — Subscription ↔ Product Tenant Cardinality (DELTA-01)

| Document ID | P7.0-ACK-DELTA-02 | Decision | **D-CARD-01** | Status | DECIDED (pending C-10 formal accept) |

## Problem

Parent freeze used shorthand `Subscription 1:1 Product Tenant`, which breaks renewals, plan changes, replacements, and historical continuity.

## Options

| Option | Meaning | Verdict |
|--------|---------|---------|
| A | New Product Tenant per Subscription | Rejected — destroys continuity on renew/upgrade |
| **B** | Durable Product Tenant (Account+Product); temporal Subscription associations | **Selected** |
| C | Tenant owned only by Account without product binding | Rejected — violates one-tenant-one-product |

## Scenario coverage (Option B)

| # | Scenario | Behavior |
|---|----------|----------|
| 1 | First subscribe | Create Product Tenant + ACTIVE association to Subscription |
| 2 | Renew same sub | Keep tenant; association continues / period updated |
| 3–5 | Upgrade/downgrade/Enterprise | Keep tenant; new association or versioned change linked to new/changed subscription; prior association SUPERSEDED |
| 6–7 | Suspend/reactivate | Tenant lifecycle technical status separate; commercial association may stay ACTIVE with suspended subscription |
| 8–9 | Terminate then re-subscribe | Close association; new association may reuse same tenant (policy) or require new tenant (policy flag) |
| 10 | Replace subscription | SUPERSEDES link between associations |
| 11 | Runtime migrate | Same tenant id; infra binding changes (P7.11) |
| 12 | Commercial pause | Tenant may remain provisioned but not commercially entitled |
| 13 | Multi-product Account | N tenants (one per product) |
| 14 | Multi-env same product | Only if commercial/product policy allows **multiple tenants per account+product** via explicit `environment_slot`; default = one active tenant per account+product |

## Selected model

```text
Account 1—N Subscriptions
Account 1—N Product Tenants
Product Tenant N—1 Product
Product Tenant 1—N SubscriptionTenantAssociations (temporal)
Subscription 1—N Associations (history); at most one ACTIVE association per subscription
```

### SubscriptionTenantAssociation (minimum)

| Field | Notes |
|-------|-------|
| association_id | PK |
| account_id | Must match tenant & subscription account |
| product_id | Must match tenant product & subscription product |
| product_tenant_id | FK Product Tenant |
| subscription_id | FK Subscription |
| association_type | INITIAL \| RENEWAL \| PLAN_CHANGE \| REPLACEMENT \| REACTIVATION \| … |
| association_status | PENDING \| ACTIVE \| SUPERSEDED \| CLOSED |
| effective_from / effective_until | **valid time** |
| recorded_at | **transaction time** |
| supersedes_association_id | Optional |
| source_event_id / correlation_id | Provenance |
| audit metadata | Actor/system |

## Integrity rules

1. `product_tenant.product_id == association.product_id == subscription.product_id`  
2. Same `account_id` across tenant, subscription, association  
3. At most one ACTIVE association per `(product_tenant_id)` for commercial entitlement **unless** multi-slot policy  
4. At most one ACTIVE association per `subscription_id`  
5. CLOSED/SUPERSEDED never silently reactivated — new association row  
6. History immutable append  

## Impacts

| Domain | Impact |
|--------|--------|
| P5 | Emit associations / tenant refs in auth when known; own commercial lifecycle |
| P7 | Product Tenant registry + association persistence; auth may create-or-bind |
| Migration | New tables later; do not overload Identity `tenants` |

## ADR

Amends **ADR-P7-006** (precision, not contradiction). New ADR optional: `ADR-P7-013 Subscription–Tenant Association` — recommended after C-10 accept.
