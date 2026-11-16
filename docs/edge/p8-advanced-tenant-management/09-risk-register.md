# 09 — Risk Register

| ID | Risque | Impact | Prob. | Mitigation |
|---|---|---|---|---|
| R1 | Confusion Identity tenant vs product tenant | Critique | Moyen | ADR-P7-003 ; naming `productTenantId` ; pas de FK forcée vers `tenants` |
| R2 | Contournement P5/P7 | Critique | Moyen | Requests P8 uniquement ; exécution via ports ; tests fail-closed |
| R3 | Fausse santé / fake metrics | Élevé | Moyen | Freshness policies ; jamais Healthy sans observation |
| R4 | Secrets dans projections | Critique | Faible | Redaction DTO ; review sécurité |
| R5 | Migration 108 collision | Moyen | Faible | Vérifié : 107 dernier numéro |
| R6 | WIP onboarding non commité sur même branche | Moyen | Élevé | Ne pas écraser fichiers onboarding ; commits séparés |
| R7 | Dual-write registry vs P7 drift | Élevé | Élevé | Reconciliation schedule + findings ; pas d’auto-fix destructive |
| R8 | Performance liste milliers tenants | Élevé | Moyen | Pagination serveur, indexes, pas de N+1 360 |
| R9 | Self-approval exceptions | Élevé | Moyen | SoD checks actor ≠ approver |
| R10 | Delete irréversible accidentel | Critique | Faible | Soft archive ; flags ; dual approval termination |
| R11 | Scope creep documentation vs code | Moyen | Élevé | Docs reflètent uniquement capacités livrées |
| R12 | Liens account/subscription incomplets | Moyen | Élevé | Registry accepte refs nulles + finding reconciliation |

## Open questions (propositions)

| OQ | Proposition |
|---|---|
| OQ-1 Mapping Identity ↔ product tenant | Optionnel `platformTenantRef` nullable ; jamais obligatoire |
| OQ-2 Source d’inscription registry | Sync depuis activation ACTIVE + upsert manuel admin autorisé |
| OQ-3 migrate/recover P7 API | P8 stocke requests ; exécution appelle P7 dès endpoints disponibles |
