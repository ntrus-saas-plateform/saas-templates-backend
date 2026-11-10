# P7.2 — Matrice REUSE / BUILD / EXTEND

**Date :** 2026-11-10  
**Périmètre :** Product / Platform / Runtime Registry (pas de provisioning runtime)

## Matrice

| Capacité | Décision | Preuve / cible |
|----------|----------|----------------|
| Catalogue produits P1 | **REUSE** | FK `edge_p7_product_registry.product_id` → `edge_products(id)` ; UI sélectionne via `edgeApi.listProducts` |
| Business backends | **REUSE** | FK optionnelle `edge_p7_product_platforms.business_backend_id` → `edge_business_backends(id)` |
| Auth Edge + `@EdgeRoute` | **REUSE** | `EdgeAuthGuard`, `EdgeOptionalWorkspaceGuard`, `EdgePermissionGuard` sur `EdgeRegistryController` |
| Permissions / rôles Edge | **EXTEND** | Inserts 096 dans `edge_permissions` + grants `EDGE_PLATFORM_SUPER_ADMIN` / `EDGE_PLATFORM_OPERATOR` |
| Outbox control-plane | **REUSE** | `ControlPlaneOutboxTransactionService` + tenant `EDGE_P7_OUTBOX_TENANT` |
| Audit durable | **REUSE** | `AuditEventRepositoryPort.create` (échec → `DEPENDENCY_UNAVAILABLE`) |
| Pattern historique / lifecycle | **REUSE (pattern)** | Aligné P7.1 / provisioning ; table dédiée `edge_p7_registry_history` |
| Tables registre P7.2 | **BUILD** | 8 tables `edge_p7_*` (migration 096) |
| Domaine registry | **BUILD** | `domain/registry/*` (types, lifecycle, compatibility, events, port) |
| Use-cases registry | **BUILD** | `application/registry/registry.use-cases.ts` |
| Persistence PG | **BUILD** | `infrastructure/registry/pg-registry.repository.ts` |
| API REST | **BUILD** | `presentation/controllers/registry.controller.ts` → `edge/registry/*` |
| Moteur compatibilité | **BUILD** | `evaluateRegistryCompatibility` (déterministe, règles explicites) |
| Profils de déploiement canoniques | **BUILD (seed)** | 5 profils seedés en 096 (`SHARED_SAAS` … `ON_PREMISE`) |
| Console FE Registry | **BUILD** | `/edge/provisioning/registry` (+ détail `[section]/[id]`) |
| Shell / gates FE | **REUSE** | `EdgePermissionGate`, states Edge, `useEdgePlatform` |
| Provisioning tenant / DB | **DO NOT BUILD** | P7.3+ |
| Keycloak / IdP provisioning | **DO NOT BUILD** | P7.3+ |
| Runtime / infra side-effects | **DO NOT BUILD** | P7.3+ |
| Second catalogue produit commercial | **FORBIDDEN** | P1 reste source de vérité commerciale |

## Frontière explicite

```
P1 catalog (commercial truth)
        │ product_id
        ▼
P7.2 technical registry ──► compatibility evaluation (read-only placement input)
        │
        ✕ no tenant create / DB migrate / Keycloak / runtime deploy
        ▼
P7.3+ provisioning execution
```

## Pourquoi REUSE vs BUILD

- **REUSE** : auth, outbox, audit, produits et backends existent déjà et sont la vérité opérationnelle.
- **BUILD** : le placement P7 exige un modèle technique distinct (certification, profils, contrats, compatibilité) non couvert par le catalogue commercial.
- **Exclusions** : tout effet de bord d’exécution reste hors P7.2 pour préserver le zero side-effect du registre.
