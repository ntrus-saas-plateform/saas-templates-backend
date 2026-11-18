# 12 — Onboarding playbook — Wholesale

**Statut :** ACTIVE — RGOM-E9.1  
**Produit :** Syntix Wholesale / distribution B2B  
**Objectif :** Time-to-value mesurable ; expansion uniquement via quote.

## Prérequis

1. Subscription ACTIVE + association Subscription↔Product Tenant ACTIVE.
2. Entitlements publiés BB ; `ready=true` fail-closed.
3. Pas de multi-produits dans le même Product Tenant.

## Séquence ops (J0–J14)

| Jour | Action | Preuve |
|------|--------|--------|
| J0 | Kickoff admin + dépôt / entrepôt | `wholesale.first_login` |
| J2 | Grille tarifaire publiée | `wholesale.price_list.published` |
| J5 | Première commande B2B | Aha `wholesale.first_order` |
| J10 | Première livraison confirmée | `wholesale.delivery.confirmed` |
| J14 | Health + churn risk | `POST /edge/cs/health-score` + `POST /edge/cs/churn-risk` |

## Anti-patterns

- Login = activation
- Silent entitlement bump quand volume approche la limite (utiliser `POST /edge/cs/expansion-signals`)
