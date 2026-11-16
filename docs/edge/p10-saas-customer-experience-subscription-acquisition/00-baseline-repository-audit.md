# P10.0 — Baseline repository audit

**Date :** 2026-11-16  
**Branche :** `feature/console`  
**Baseline SHAs :** BE `25920e0` · FE `0994253`

## Git

| | Backend | Frontend |
|--|---------|----------|
| Remote | `ntrus-saas-plateform/saas-templates-backend` | `ntrus-saas-plateform/saas-template-frontend` |
| HEAD (baseline) | `25920e0` | `0994253` |
| Working tree (prérequis) | clean ; P9 committed | — |

**Prérequis :** P9 committed. Dernière migration control-plane : `116_edge_p9_operations_core.sql`.  
**Prochaine migration P10 :** **`117_edge_p10_*`**.

## Sources of truth à réutiliser (pas de duplication)

| Phase | Domaine | Rôle vs P10 |
|-------|---------|-------------|
| **P1** | `edge_products` / catalog | Produits canoniques — P10 ne stocke que des **présentations** / content versions référencant `product_id` |
| **P2** | `edge_commercial_plans` (+ pricing commercial) | Plans / disponibilité commerciale — P10 `plan_presentations` avec `price_display_mode` ; **jamais** inventer un prix |
| **P4** | `edge_sales_commercial_accounts` (+ CRM) | Comptes commerciaux — P10 prospects/leads peuvent lier `commercial_account_id` ; SoT compte = P4 |
| **P5** | Subscription / entitlement | Cible du **subscription handoff** ; P10 n’émet que des refs / handoffs, pas d’entitlements |
| **P6** | Billing / payment | Checkout P10 orchestre des sessions ; paiement réel / credentials / invoices = P6 |

## Explicitement hors P10 (ne pas remplacer)

| Zone existante | Décision |
|----------------|----------|
| Marketing forms / leads / campaigns (`marketing/*`) | **≠** moteur de formulaires d’acquisition P10. Les forms marketing restent acquisition marketing ; P10 owns application/KYC/qualification schemas. |
| P7 provisioning / Keycloak / tenant IAM | Pas de tenant IAM dans P10 ; activation post-handoff reste P7/P8. |
| P8 tenant registry / 360 | Consommable en lecture après conversion ; pas d’ownership. |
| P9 operations | Indépendant ; pas de couplage acquisition. |

## Absents (à construire en P10)

Aucun module `acquisition` sous `src/modules/edge/domain`.  
Aucune table `edge_p10_*`.  
Aucun permission `platform:acquisition:*`.  
Aucune nav Console « Acquisition / Customer Experience » dédiée P10.

## Patterns à réutiliser

- Hexagonal : `domain` / `application` / `infrastructure` / `presentation` (comme P9)
- Permissions `platform:<domain>:<action>` + grant `EDGE_PLATFORM_SUPER_ADMIN`
- Outbox + audit fail-closed sur mutations sensibles
- Versions immutables après publish (aligné runbooks / marketing form publish patterns)
- Optimistic concurrency via `version` INTEGER

## Migrations control-plane

- Convention : `{NNN}_edge_{pN|domaine}_{slug}.sql`
- Dernière : `116_edge_p9_operations_core.sql`
- **Next :** `117_edge_p10_acquisition_foundation.sql`

## Verdict baseline

**Prêt pour P10.0 foundation** — greenfield acquisition CX sur SoT P1/P2/P4/P5/P6 existants, sans duplicate catalog/commercial/billing/subscription, et sans confondre marketing forms avec le form engine P10.
