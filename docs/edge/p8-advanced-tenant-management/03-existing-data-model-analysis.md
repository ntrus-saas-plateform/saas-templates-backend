# 03 — Existing Data Model Analysis

## Sources de vérité actuelles

| Concept | Table(s) | Owner |
|---|---|---|
| Platform tenant | `tenants` | Identity |
| Commercial account | `edge_sales_commercial_accounts` (+ aliases historiques) | Sales P3/P4 |
| Subscription | `edge_subscriptions` | P5 |
| Provisioning auth | `edge_provisioning_authorizations` (`product_tenant_id`) | P7.1 |
| Provisioning request | `edge_p7_provisioning_requests` | P7.1 |
| Placement | `edge_p7_placement_requests` | P7.3 |
| Infra / DB | `edge_p7_resource_plans`, `edge_p7_database_resources` | P7.6 |
| Keycloak | `edge_p7_keycloak_topologies` | P7.7 |
| Config | `edge_p7_tenant_configuration_assignments` | P7.8 |
| Experience | `edge_p7_tenant_experience_assignments` | P7.9 |
| Activation | `edge_p7_activation_records`, readiness evaluations | P7.10 |
| Technical lifecycle | `edge_p7_tenant_lifecycle_records` (+ runs/history/evidence) | P7.11 |
| Onboarding | `edge_p7_onboarding_journeys` | P7.12 |
| Billing | `edge_billing_*` | P6 |

## Invariants observés

- Un enregistrement lifecycle actif unique par `(tenant_id, product_id)` hors états terminaux.
- Subscription P5 **sans** colonne `tenant_id` ; lien via authorization / `tenant_ref` / `product_tenant_id`.
- Billing ne référence pas directement le product tenant.

## Lacunes modèle pour P8

1. Pas de table registre administrative product tenant (code, slug, classification, owner interne).
2. Pas de dimensions Administrative Status / Governance Status persistées hors P7.
3. Pas de tables exceptions, demandes migration/recovery/termination gouvernées, findings réconciliation.
4. Pas d’activity timeline consolidée (événements dispersés).
5. Pas de snapshots analytics portefeuille.

## Stratégie modèle cible (résumé)

Introduire `edge_p8_*` comme **registre et gouvernance**, avec références FK/logiques vers P5/P7 quand disponibles, sans dupliquer l’autorité technique ni contractuelle.

**Migration :** `108_edge_p8_advanced_tenant_management.sql`
