# 05 — Gap Analysis

Légende : **C**omplet | **P**artiel | **A**bsent | **D**oublon à éviter

| Capacité mandatée | État | Notes |
|---|---|---|
| P8.1 Advanced Tenant Registry | A | À créer (`edge_p8_tenants`) |
| Identité stable product tenant | P | UUID existe dans P7, pas de code/slug/classification admin |
| Classification configurable | A | |
| Recherche avancée / export | A | Listes P7 filtrées par tenantId seulement |
| Détection orphelins / doublons | A | |
| P8.2 Tenant 360° | A | Agrégation manuelle aujourd’hui |
| Commercial overview | P | APIs subscriptions/billing existent |
| Technical overview | P | APIs P7 existent, non unifiées |
| Timeline consolidée | A | |
| P8.3 Administration & control | A | Metadata admin absente |
| Bulk operations | A | |
| P8.4 Lifecycle governance admin | P | P7.11 technique présent ; états admin/governance absents |
| Dual approval | P | Human tasks workflow existent ; SoD P8 à définir |
| P8.5 Configuration governance (admin prefs) | A | P7.8 = deploy technique, distinct |
| P8.6 Commercial relationship refs | P | Links via subscription/account |
| P8.7 Resource registry consolidé | P | Lecture P7.6+ ; pas de registre P8 |
| P8.8 Health consolidé | A | Pas de freshness policy unifiée |
| P8.9 Risk & compliance | A | |
| P8.10 Exceptions | A | |
| P8.11 Migration governance | P | Enum/permission SQL ; API manquante |
| P8.12 Recovery governance | P | Idem |
| P8.13 Retention / termination | P | Flags deletion_protection / export evidence P7 |
| P8.14 Reconciliation globale | A | Silos seulement |
| P8.15 Audit / evidence admin | P | Audit Edge générique + lifecycle evidence |
| P8.16 Analytics | A | |
| P8.17 API P8 | A | |
| P8.18 RBAC P8 | A | Permissions à ajouter |
| P8.19 Admin Console | A | Nav disabled |
| P8.20 Events P8 | A | |

## Doublons à ne pas créer

- Ne pas recréer `edge_p7_tenant_lifecycle_records` sous un autre nom pour l’exécution technique.
- Ne pas dupliquer `edge_subscriptions` comme source contractuelle.
- Ne pas créer un second IAM métier.
- Ne pas utiliser Identity `tenants.id` comme PK product tenant.

## Dettes techniques impactant P8

1. Lien `product_tenant_id` ↔ références commerciales parfois VARCHAR (`tenant_ref`).
2. Onboarding (107) encore non commité / WIP sur la branche.
3. migrate/recover lifecycle non branchés — P8 doit gouverner les demandes et pousser l’exécution via P7.
