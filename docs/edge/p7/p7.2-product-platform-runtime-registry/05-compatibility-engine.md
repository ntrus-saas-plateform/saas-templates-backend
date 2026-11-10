# P7.2 — Moteur de compatibilité

**Fichier :** `src/modules/edge/domain/registry/compatibility-engine.ts`  
**Fonction :** `evaluateRegistryCompatibility(input)`  
**Principe :** évaluation **déterministe**, **sans match implicite**, sans chemin de succès mock.

## Entrée

```ts
{
  product, technicalVersion, platform, environment, profile, contract,
  evaluatedBy?, correlationId?, now?
}
```

Toutes les ressources sont **requises** côté use-case (chargées depuis le repo avant appel).

## Sortie

`Omit<CompatibilityEvaluation, 'id' | 'createdAt'>` :

- `result` : `COMPATIBLE` | `INCOMPATIBLE` | `REQUIRES_REVIEW`
- `rulesApplied[]`, `reasons[]`
- `examinedRefs` (versions / codes examinés)
- `correlationId`, `evaluatedAt`, FKs des ressources

## Règle de décision

| Condition | Résultat |
|-----------|----------|
| ≥ 1 règle bloquante échouée | `INCOMPATIBLE` |
| 0 bloqueur, ≥ 1 règle « review only » échouée | `REQUIRES_REVIEW` |
| Toutes OK | `COMPATIBLE` |

## Catalogue de règles

| Règle | Type | Critère |
|-------|------|---------|
| `PRODUCT_CERTIFIED` | blocker | registry CERTIFIED + certification CERTIFIED + `provisionable` |
| `TECHNICAL_VERSION_SUPPORTED` | blocker | version status = PUBLISHED |
| `TECHNICAL_VERSION_SUPPORT_WINDOW` | blocker | `supportEndsAt` non dépassé (si défini) |
| `PLATFORM_ACTIVE_CERTIFIED` | blocker | platform ACTIVE + CERTIFIED |
| `PRODUCT_PLATFORM_ALLOWLIST` | blocker | `platform.allowedProductIds` contient `productId` **ou** `product.compatiblePlatformIds` contient `platform.id` — **pas d’allowlist vide = match** |
| `ENVIRONMENT_ACTIVE` | blocker | environment ACTIVE |
| `ENVIRONMENT_BELONGS_TO_PLATFORM` | blocker | `environment.platformId === platform.id` |
| `PLATFORM_SUPPORTS_ENVIRONMENT_TYPE` | blocker | type env ∈ `supportedEnvironmentTypes` |
| `PROFILE_ACTIVE_CERTIFIED` | blocker | profile ACTIVE + CERTIFIED |
| `PROFILE_PLATFORM_COMPAT` | blocker | code profil ∈ `platform.supportedProfileCodes` |
| `PROFILE_ENVIRONMENT_COMPAT` | blocker | si `allowedProfileCodes` non vide → contient le code |
| `PROFILE_VERSION_COMPAT` | blocker | si version liste des profils → contient le code |
| `PROFILE_ENVIRONMENT_TYPE` | blocker | si profil liste des types env → contient le type |
| `CONTRACT_PUBLISHED_OR_CERTIFIED` | blocker | contract CERTIFIED ou PUBLISHED |
| `CONTRACT_NOT_RETIRED` | blocker | pas DEPRECATED / RETIRED |
| `CONTRACT_PRODUCT_MATCH` | blocker | `contract.productId === product.productId` |
| `CONTRACT_PLATFORM_MATCH` | blocker | `contract.platformId === platform.id` |
| `CONTRACT_VERSION_COMPAT` | **review** | si version liste des contract versions → match |
| `PRODUCTION_DATA_RESIDENCY_DECLARED` | **review** | PRODUCTION ⇒ `dataResidencyConstraints` non vide |
| `PRODUCTION_SECURITY_CLASSIFICATION` | **review** | PRODUCTION ⇒ `securityClassification` présent |

## Persistance & événements

Use-case `EvaluateCompatibilityUseCase` :

1. Charge les 6 ressources (404 si manquante).
2. Appelle le moteur.
3. Persiste dans `edge_p7_compatibility_evaluations`.
4. Append history (`COMPATIBILITY_EVALUATION`).
5. Outbox : `p7.registry.compatibility.evaluated.v1`.
6. Audit : `registry.compatibility.evaluated`.

## Tests

`compatibility-engine.spec.ts` — cas COMPATIBLE / INCOMPATIBLE / REQUIRES_REVIEW (allowlist, statuses, PRODUCTION review).  
Commandes d’exécution : placeholders dans `08-test-evidence.md`.
