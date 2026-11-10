# P7.2 — Résumé d’implémentation

**Package :** Product / Platform / Runtime Registry  
**Statut code :** implémenté (backend + frontend)  
**Migration :** `migrations/control-plane/096_edge_p7_product_platform_runtime_registry.sql`  
**Exécution migrate runtime :** non affirmée ici (voir `10-p7.2-acceptance-report.md`)

## Objectif

Fournir les **registres techniques** nécessaires au placement/contrôle de provisioning P7, sans effets de bord tenant / infra / Keycloak :

- registre produit technique (extension métadonnées P7 sur produits P1) ;
- versions techniques ;
- plateformes produit ;
- environnements runtime ;
- profils de déploiement (seedés) ;
- contrats de contrôle produit↔plateforme ;
- moteur de compatibilité déterministe + historique unifié.

## Découpage REUSE / BUILD

| Décision | Cible |
|----------|--------|
| **REUSE** | `edge_products`, `edge_business_backends`, outbox CP, audit Edge, guards `@EdgeRoute` / `EdgeAuthGuard` / `EdgePermissionGuard` |
| **BUILD** | Tables `edge_p7_*` (096), domaine `domain/registry/*`, use-cases, `PgRegistryRepository`, `EdgeRegistryController`, UI `/edge/provisioning/registry` |
| **HORS SCOPE (P7.3+)** | Provisioning tenant/DB/Keycloak/runtime, workflows d’exécution, side-effects infra |

## Artefacts clés

| Couche | Chemin |
|--------|--------|
| Migration | `migrations/control-plane/096_edge_p7_product_platform_runtime_registry.sql` |
| Types / enums | `src/modules/edge/domain/registry/registry.types.ts` |
| Lifecycle | `src/modules/edge/domain/registry/registry-lifecycle.ts` |
| Compatibilité | `src/modules/edge/domain/registry/compatibility-engine.ts` |
| Events | `src/modules/edge/domain/registry/registry.events.ts` (`p7.registry.*.v1`) |
| Port | `src/modules/edge/domain/registry/registry-repository.port.ts` |
| Use-cases | `src/modules/edge/application/registry/registry.use-cases.ts` |
| PG repo | `src/modules/edge/infrastructure/registry/pg-registry.repository.ts` |
| API | `src/modules/edge/presentation/controllers/registry.controller.ts` → `@Controller('edge/registry')` |
| FE liste | `saas-template-frontend/app/(edge-console)/edge/provisioning/registry/page.tsx` |
| FE détail | `.../registry/[section]/[id]/page.tsx` |
| Tests | `compatibility-engine.spec.ts`, `registry-lifecycle.spec.ts` |

## Principes appliqués

1. **Pas de duplication du catalogue commercial** — `product_id` référence `edge_products`.
2. **Pas de secrets en clair** — `secure_config_ref` = handle opaque uniquement.
3. **Compatibilité explicite** — aucune correspondance implicite plateforme/produit.
4. **Immutabilité post-publication** — versions techniques & contrats publiés non mutables.
5. **Audit + outbox obligatoires** sur mutations (échec audit = erreur domaine).
6. **Provisionnable** seulement si `registry_status=CERTIFIED` **et** `certification_status=CERTIFIED` (contrainte SQL + domaine).

## Livrables documentation (ce pack)

| Fichier | Contenu |
|---------|---------|
| `01` | Matrice REUSE / BUILD / exclus |
| `02` | Modèle de domaine & cycles de vie |
| `03` | Modèle de données & migration 096 |
| `04` | Contrats API `edge/registry/*` |
| `05` | Moteur de compatibilité |
| `06` | RBAC, audit, events |
| `07` | Frontend console |
| `08` | Preuves de tests (placeholders commandes) |
| `09` | Revue sécurité |
| `10` | Rapport d’acceptance G1-style |
