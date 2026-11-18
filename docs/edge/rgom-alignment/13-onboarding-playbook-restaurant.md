# 13 — Onboarding playbook — Restaurant Independent / Multi-site

**Statut :** ACTIVE — RGOM-E9.1  
**Produit :** Syntix Restaurant  
**Objectif :** Première couverture / ticket = Aha ; multi-site = orgs/sites entitlement, jamais silent bump.

## Prérequis

1. Subscription ACTIVE + association ACTIVE.
2. Entitlements sites / caisses publiés.
3. Multi-site : chaque établissement = org slot granté (expansion via quote si AT_LIMIT).

## Séquence ops (J0–J14)

| Jour | Action | Preuve |
|------|--------|--------|
| J0 | Kickoff site + admin | `restaurant.first_login` |
| J1 | Menu publié | `restaurant.menu.published` |
| J3 | Premier ticket / cover | Aha `restaurant.first_ticket` |
| J7 | Première clôture de shift | `restaurant.shift.closed` |
| J14 | Health + expansion sites | health-score + expansion-signals (SITES/USERS) |

## Multi-site

Si `observed sites >= granted` → `POST /edge/cs/expansion-signals` path QUOTE / PLAN_CHANGE — jamais activer un site hors grant Edge.
