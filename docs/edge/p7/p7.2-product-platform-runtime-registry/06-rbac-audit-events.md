# P7.2 — RBAC, audit & événements

## Permissions (migration 096)

| Code | Description |
|------|-------------|
| `platform:product_registry:read` | Lecture registre produit |
| `platform:product_registry:manage` | Création / update registre & versions |
| `platform:product_registry:certify` | Transitions certification produit |
| `platform:product_platforms:read` | Lecture plateformes |
| `platform:product_platforms:manage` | Gestion plateformes |
| `platform:runtime_environments:read` | Lecture environnements |
| `platform:runtime_environments:manage` | Gestion environnements |
| `platform:deployment_profiles:read` | Lecture profils |
| `platform:deployment_profiles:manage` | Update / transition profils |
| `platform:product_control_contracts:read` | Lecture contrats |
| `platform:product_control_contracts:manage` | Création / update draft contrats |
| `platform:product_control_contracts:certify` | Certification / publish contrats |
| `platform:registry_compatibility:evaluate` | Évaluer / lire évaluations |
| `platform:registry_history:read` | Lecture historique registre |

### Grants rôles

| Rôle | Permissions |
|------|-------------|
| `EDGE_PLATFORM_SUPER_ADMIN` | toutes les permissions `platform:product_registry:*`, `product_platforms:*`, `runtime_environments:*`, `deployment_profiles:*`, `product_control_contracts:*`, `registry_*` |
| `EDGE_PLATFORM_OPERATOR` | read + manage (produits/plateformes/envs/profils/contrats) + evaluate + history ; **sans** `*:certify` produit/contrat |

Application API : `@RequireEdgePermissions(...)` sur chaque handler du controller.

## Audit durable

Pattern use-case (`requireAudit`) :

- Port : `AuditEventRepositoryPort.create`
- Échec → `DomainError(DEPENDENCY_UNAVAILABLE, 'Durable audit required for registry mutation')`
- Types audit (exemples) : `registry.product.registered`, `registry.product.updated`, transitions, platform/environment/profile/contract, `registry.compatibility.evaluated`

Sujet typique : `subjectType` = resource type domaine, `subjectId` = UUID ressource, `actorId` = JWT `sub`/`id`.

## Historique unifié

Table `edge_p7_registry_history` — append via `repo.appendHistory` sur register / transition / evaluate.

Champs : `resource_type`, `resource_id`, `from_status`, `to_status`, `action`, `reason`, `actor_id`, `details`.

## Événements outbox `p7.registry.*.v1`

Source : `registry.events.ts` — `source: 'okapi.edge.p7'`, tenant outbox `EDGE_P7_OUTBOX_TENANT`, `version: 1`.

| eventType | Agrégat | Payload clé |
|-----------|---------|-------------|
| `p7.registry.product.registered.v1` | PRODUCT_REGISTRY | productRegistryId, productId |
| `p7.registry.product.updated.v1` | PRODUCT_REGISTRY | productRegistryId |
| `p7.registry.product.certified.v1` | PRODUCT_REGISTRY | productRegistryId |
| `p7.registry.product.deprecated.v1` | PRODUCT_REGISTRY | productRegistryId, reason |
| `p7.registry.platform.registered.v1` | PRODUCT_PLATFORM | platformId, code |
| `p7.registry.environment.registered.v1` | RUNTIME_ENVIRONMENT | environmentId, platformId |
| `p7.registry.deployment_profile.updated.v1` | DEPLOYMENT_PROFILE | profileId, code |
| `p7.registry.control_contract.published.v1` | PRODUCT_CONTROL_CONTRACT | contractId, contractVersion |
| `p7.registry.compatibility.evaluated.v1` | COMPATIBILITY_EVALUATION | evaluationId, result |

Enqueue via `ControlPlaneOutboxTransactionService.runWithOutbox(EDGE_P7_OUTBOX_TENANT, ...)`.

## Séparation des responsabilités

| Canal | Usage |
|-------|--------|
| Outbox intégration | Consommateurs async / orchestration P7.3+ |
| Audit Edge | Conformité / forensics UI |
| Registry history | Timeline métier registre |
