# P7.0 — API & Event Inventory (baseline)

## Existing P5 → P7 signals (documented / stubbed)

From `docs/edge/p5/08-integration-contracts.md` and code:

| Event / signal | Status | P7 action |
|----------------|--------|-----------|
| `subscription.provisioning_requested.v1` | Documented; adapter UNAVAILABLE | Consume → durable request |
| `subscription.provisioning_completed.v1` | Documented | Emit from P7 when done |
| `subscription.provisioning_failed.v1` | Documented | Emit on terminal failure |
| Table `edge_subscription_provisioning_requests` | Present (089) | Coordination trail — extend or dual-write carefully |

Port: `SubscriptionProvisioningCoordinationPort.requestProvisioning` — **Unavailable** today.

## Existing Edge APIs (reuse patterns, not P7)

- `/edge/backends` — catalog backends metadata
- `/edge/products`, readiness, commercial, sales, subscriptions, billing
- No `/edge/provisioning/*`, `/edge/workflows/*`, `/edge/capacity/*`

## Required new contracts (to deliver with phases)

| Contract | Phase |
|----------|-------|
| P5 Authorization → P7 Request | P7.1 |
| Product / Platform / Runtime Registry APIs | P7.2 |
| Placement & Capacity APIs | P7.3 |
| Workflow APIs | P7.4 |
| Product Control Contract (BB) | P7.5 |
| Infra adapter interfaces | P7.6 |
| Keycloak topology APIs | P7.7 |
| Config / entitlement deploy | P7.8 |
| Application access | P7.9 |
| Readiness / activation | P7.10 |
| Lifecycle | P7.11 |
| Onboarding | P7.12 |
| Reconciliation | P7.13 |
| Connectivity Agent | P7.14 |

## Schema inventory (CP migrations relevant)

| Migration | Content | P7 note |
|-----------|---------|---------|
| 074 | Product catalog / backends | Seed registry |
| 085 | Sales provisioning references | VERIFY |
| 088 | Entitlements | Input to deploy |
| 089 | Billing + provisioning coordination | P5 trail |
| 090–094 | Billing | No P7 tables |

**No P7-owned provisioning schema exists yet.**
