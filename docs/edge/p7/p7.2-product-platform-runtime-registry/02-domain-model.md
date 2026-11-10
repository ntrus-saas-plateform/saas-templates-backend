# P7.2 — Modèle de domaine

**Sources :** `registry.types.ts`, `registry-lifecycle.ts`, `compatibility-engine.ts`

## Agrégats / ressources

| Ressource | Identité | Rôle |
|-----------|----------|------|
| **ProductRegistry** | `id` ; unique `product_id`, `code` | Métadonnées techniques P7 d’un produit P1 |
| **ProductTechnicalVersion** | `id` ; unique `(product_registry_id, technical_version)` | Version technique publiable / immuable après publish |
| **ProductPlatform** | `id` ; unique `code` | Plateforme d’hébergement / contrôle |
| **RuntimeEnvironment** | `id` ; unique `(platform_id, code)` | Environnement (DEV/TEST/STAGING/PROD) rattaché à une plateforme |
| **DeploymentProfile** | `id` ; unique `code` (enum canonique) | Profil d’isolation / connectivité (seed système) |
| **ProductControlContract** | `id` ; unique `(contract_code, contract_version)` | Contrat de contrôle produit↔plateforme |
| **CompatibilityEvaluation** | `id` + `correlation_id` | Résultat déterministe d’évaluation (audit trail) |
| **RegistryHistory** | append-only | Historique unifié des mutations / transitions |

## Enums principaux

| Enum | Valeurs |
|------|---------|
| `RegistryLifecycleStatus` | DRAFT → VALIDATING → CERTIFIED → SUSPENDED / DEPRECATED → RETIRED |
| `CertificationStatus` | UNCERTIFIED, PENDING, CERTIFIED, REVOKED |
| `TechnicalVersionStatus` | DRAFT → VALIDATING → PUBLISHED → DEPRECATED → RETIRED |
| `PlatformType` | SHARED_SAAS_PLATFORM, DEDICATED_PLATFORM, PRIVATE_PLATFORM, ON_PREMISE_PLATFORM |
| `PlatformOperationalStatus` | DRAFT → VALIDATING → ACTIVE → SUSPENDED / DEPRECATED → RETIRED |
| `RuntimeEnvironmentType` | DEVELOPMENT, TEST, STAGING, PRODUCTION |
| `EnvironmentStatus` | DRAFT → VALIDATING → ACTIVE → SUSPENDED / DEPRECATED → RETIRED |
| `DeploymentProfileCode` | SHARED_SAAS, DEDICATED_DATA, DEDICATED_RUNTIME, PRIVATE_CLOUD, ON_PREMISE |
| `ProfileStatus` | DRAFT → VALIDATING → ACTIVE → SUSPENDED / DEPRECATED → RETIRED |
| `ControlContractStatus` | DRAFT → VALIDATING → CERTIFIED → PUBLISHED → DEPRECATED → RETIRED |
| `CompatibilityResult` | COMPATIBLE, INCOMPATIBLE, REQUIRES_REVIEW |

## Machines d’état (transitions autorisées)

Implémentées dans `registry-lifecycle.ts` ; transition invalide → `INVALID_STATE_TRANSITION`.

### Product registry

```
DRAFT ──► VALIDATING ──► CERTIFIED ──► SUSPENDED
  │            │              │            │
  └─► RETIRED  ├─► DRAFT      ├─► DEPRECATED ├─► CERTIFIED
               └─► SUSPENDED  │              ├─► DEPRECATED
                              │              └─► RETIRED
                              └─► DEPRECATED ──► RETIRED
```

- **Reason obligatoire** pour SUSPENDED / DEPRECATED / RETIRED.
- `isProvisionable` = CERTIFIED + certification CERTIFIED.

### Technical version

DRAFT → VALIDATING → PUBLISHED → DEPRECATED → RETIRED (avec retours VALIDATING→DRAFT, etc.).  
`assertMutableTechnicalVersion` : mutation seulement en DRAFT/VALIDATING.

### Platform / Environment / Profile

Même pattern opérationnel : DRAFT → VALIDATING → ACTIVE → SUSPENDED/DEPRECATED → RETIRED.  
Platform : reason obligatoire sur transitions sensibles.

### Control contract

DRAFT → VALIDATING → CERTIFIED → PUBLISHED → DEPRECATED → RETIRED.  
`assertMutableContract` : bloqué si `immutable` ou status PUBLISHED.  
Reason obligatoire pour DEPRECATED / RETIRED.

## Invariants métier

1. Un produit P1 n’a **qu’une** entrée registre (`UNIQUE product_id`).
2. `provisionable=true` uniquement si registre + certification CERTIFIED (CHECK SQL).
3. Pas de match implicite produit↔plateforme (allowlist ou `compatiblePlatformIds`).
4. Contrats et versions publiés : **nouvelle version** plutôt que mutation.
5. Plateforme : `secureConfigRef` = référence opaque, jamais un secret.
6. Évaluation de compatibilité : pure fonction + persistance du résultat (pas de succès mock).

## Relations

```
edge_products (P1)
    └── ProductRegistry ──┬── ProductTechnicalVersion
                          └── (refs UUID[] platforms / envs / profiles / contracts)

ProductPlatform ── RuntimeEnvironment
       │
       └── ProductControlContract ── edge_products

DeploymentProfile (seeded codes)

CompatibilityEvaluation references all of the above (nullable FKs ON DELETE SET NULL)
```
