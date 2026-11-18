# 11 — Onboarding playbook — Retail Pharmacy (Syntix beachhead)

**Statut :** ACTIVE — RGOM-E9.1  
**Produit :** Syntix Pharma / Retail Pharmacy  
**Objectif :** Time-to-value mesurable sans silent entitlement bump.

## Prérequis

1. Subscription ACTIVE (gates commercial + billing SUCCEEDED + provisioning).
2. Association Subscription↔Product Tenant ACTIVE (D-CARD-01).
3. Entitlements publiés BB non vides ; `ready=true` fail-closed.
4. Geo payment method autorisé si facturation locale (WAEMU MM / card).

## Séquence ops (J0–J14)

| Jour | Action | Preuve |
|------|--------|--------|
| J0 | Kickoff : compte, établissement, admin initial | Tenant ACTIVE ; admin invite accepted |
| J1 | Catalogue / stock minimal + utilisateurs caisse | Adoption event `pharmacy.catalog.seeded` (BB→Edge) |
| J3 | Première vente / dispensation | Aha `pharmacy.first_sale` |
| J7 | Revue entitlements vs usage réel | Drift-scan clean ; pas d’expansion silencieuse |
| J14 | Health check + renewal signal | Health score v1 + delinquency flag |

## Aha moments (cibles)

- `pharmacy.first_login`
- `pharmacy.catalog.seeded`
- `pharmacy.first_sale`
- `pharmacy.inventory.reconciled`

Ingestion : BB émet → Edge CS consomme (E9 ingestion). Tant que non branché, documenter events manuellement dans evidence pack.

## Anti-patterns

- Activer modules hors grant Edge
- Multi-produits dans un même Product Tenant
- Considérer login = activation / Aha
