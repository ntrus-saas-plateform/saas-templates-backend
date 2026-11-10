# 01 — Delta Scope and Governance

| Document ID | P7.0-ACK-DELTA-01 | Version | 1.0.0 |

## In scope

Clarify and close ambiguities of parent ACK `1.0.0-freeze`: cardinality, auth contract, trust, revocation, idempotency/cancel, events, request vs workflow, countersignature effectiveness, C-01…C-10, G1 criteria, dependency boundaries, Keycloak preservation.

## Out of scope

Any P7.1+ application code, migrations, APIs, FE, BB clients, KC mutations, feature-flag activation, workflow engine, infrastructure.

## Parent artifacts examined

- `docs/edge/p7/p7.0-ack-architecture-freeze/00`–`19`  
- `docs/edge/p7/p7.0-repository-audit/**`  
- Code: `provisioning-coordination.port.ts`, `unavailable-provisioning.adapter.ts`, `subscription.events.ts`, `billing.events.ts`, migration `089`  
- Evidence classes per §3.1 of the mission prompt  

## Classification snapshot (key items)

| Item | Status |
|------|--------|
| Unavailable provisioning adapter | VERIFIED_IN_CODE |
| ProvisioningRequestInput incomplete vs ideal auth | VERIFIED_IN_CODE |
| subscription.provisioning.requested.v1 | VERIFIED_IN_CODE |
| First-class Authorization aggregate | NOT_IMPLEMENTED |
| Product Tenant registry | NOT_IMPLEMENTED |
| Durable workflow engine | NOT_IMPLEMENTED |
| Live KC version | UNVERIFIED |
| BB Product Control | NOT_IMPLEMENTED |
| Human countersignatures | DOCUMENTED_ONLY (pending) |

## Authority

This Delta amends/clarifies freeze documentation. It does **not** expand implementation scope beyond parent ACK restrictions.
