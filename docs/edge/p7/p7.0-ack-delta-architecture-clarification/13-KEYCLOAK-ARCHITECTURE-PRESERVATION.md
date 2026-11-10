# 13 — Keycloak Architecture Preservation (DELTA-12)

| Document ID | P7.0-ACK-DELTA-13 |

## Confirmation

P7.1 clarifications **do not** collapse Keycloak topology. Modes A–D remain architecturally supported.

| Concept | Distinct |
|---------|----------|
| Product Tenant | Isolation boundary |
| IdentityRealmBinding | Technical realm |
| IdentityOrganizationBinding | KC org |
| IdentityClientBinding | Clients |
| EstablishmentMapping | Explicit map to BB establishment |

BB owns Business Organizations & Establishments. P7 owns technical bindings/verification via Product Control.

## Production certification

Still gated by **C-04**. No Mode production-ready claim from this Delta.
