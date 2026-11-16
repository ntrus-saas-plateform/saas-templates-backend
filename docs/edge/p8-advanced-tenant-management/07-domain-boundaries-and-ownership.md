# 07 — Domain Boundaries and Ownership

## Ownership matrix

| Donnée | Owner | P8 role |
|---|---|---|
| Platform Identity tenant | Identity | Reference only if explicit mapping exists |
| Account commercial | Sales / Commercial | Read + display |
| Subscription / entitlements / contract periods | P5 | Read ; request via P5 |
| Invoices / payments / ledger | P6 | Read refs |
| Provisioning authorization & execution | P7 | Trigger / observe |
| Product Control / infra / Keycloak / config deploy | P7 | Observe + request ops |
| Technical lifecycle execution | P7.11 | Request + track |
| Administrative metadata, tags, owners | **P8** | Own |
| Administrative / governance status | **P8** | Own |
| Exceptions admin | **P8** | Own |
| Migration/recovery/termination **requests** | **P8** | Own intent ; P7/P5 execute |
| Reconciliation findings (Edge-side) | **P8** | Own |
| Business users / orgs / roles | Business Backend | Never own |

## Invariants non négociables

1. Un product tenant ↔ **un seul** product.
2. Account ≠ Tenant.
3. Pas de secrets dans le registre P8.
4. Pas de delete physique par défaut.
5. Pas d’auto-approval si séparation des responsabilités requise.
6. Pas de contournement P5 authorization ou P7.1 fail-closed.

## Anti-corruption

- DTO P8 utilisent `productTenantId` (jamais ambigu « tenantId » seul dans les contrats publics mixtes lorsque Identity est aussi présent).
- Projections techniques marquées `sourceSystem`, `observedAt`, `freshness`.
