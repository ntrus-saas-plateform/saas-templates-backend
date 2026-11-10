# P7.2 — Contrats API

**Controller :** `EdgeRegistryController`  
**Base path :** `/api/v1/edge/registry` (préfixe global API + `@Controller('edge/registry')`)  
**Guards :** `@EdgeRoute()` + `EdgeAuthGuard` + `EdgeOptionalWorkspaceGuard` + `EdgePermissionGuard`  
**Auth :** Bearer (Swagger `@ApiBearerAuth`)  
**Tag :** `edge-p7-registry`

Pagination liste standard : `limit` (défaut 20), `offset` (défaut 0), filtres optionnels `status`, `q`.

## Products

| Méthode | Path | Permission | Body / notes |
|---------|------|------------|--------------|
| GET | `/products` | `platform:product_registry:read` | query: limit, offset, status, q |
| GET | `/products/:id` | idem | 404 si absent |
| POST | `/products` | `platform:product_registry:manage` | `{ productId, code, name, description?, verticalCategory? }` |
| PATCH | `/products/:id` | manage | `{ expectedVersion, patch }` (optimistic lock) |
| POST | `/products/:id/transition` | `platform:product_registry:certify` | `{ toStatus, reason? }` |
| GET | `/products/:id/versions` | read | liste versions |
| POST | `/products/:id/versions` | manage | `{ technicalVersion, releaseChannel?, changeSummary? }` |

## Technical versions

| Méthode | Path | Permission | Notes |
|---------|------|------------|-------|
| PATCH | `/versions/:id` | manage | draft/validating only |
| POST | `/versions/:id/transition` | manage | `{ toStatus }` |

## Platforms

| Méthode | Path | Permission | Body / notes |
|---------|------|------------|--------------|
| GET | `/platforms` | `platform:product_platforms:read` | |
| GET | `/platforms/:id` | read | |
| POST | `/platforms` | manage | `{ code, name, description?, platformType, businessBackendId?, allowedProductIds?, supportedEnvironmentTypes?, supportedProfileCodes?, connectivityReference?, secureConfigRef? }` |
| PATCH | `/platforms/:id` | manage | `{ expectedVersion, patch }` |
| POST | `/platforms/:id/transition` | manage | `{ toStatus, reason? }` |

## Environments

| Méthode | Path | Permission | Notes |
|---------|------|------------|-------|
| GET | `/environments` | `platform:runtime_environments:read` | query + `platformId?` |
| GET | `/environments/:id` | read | |
| POST | `/environments` | manage | `{ platformId, code, name, environmentType, region?, geoZone?, securityClassification?, dataClassification?, allowedProfileCodes?, dataResidencyConstraints? }` |
| PATCH | `/environments/:id` | manage | `{ expectedVersion, patch }` |
| POST | `/environments/:id/transition` | manage | `{ toStatus, reason? }` |

## Deployment profiles

| Méthode | Path | Permission | Notes |
|---------|------|------------|-------|
| GET | `/deployment-profiles` | `platform:deployment_profiles:read` | seedés ; pas de POST create |
| GET | `/deployment-profiles/:id` | read | |
| PATCH | `/deployment-profiles/:id` | manage | métadonnées / contraintes |
| POST | `/deployment-profiles/:id/transition` | manage | `{ toStatus, reason? }` |

## Control contracts

| Méthode | Path | Permission | Notes |
|---------|------|------------|-------|
| GET | `/control-contracts` | `platform:product_control_contracts:read` | query + productId?, platformId? |
| GET | `/control-contracts/:id` | read | |
| POST | `/control-contracts` | manage | `{ productId, platformId, contractCode, contractVersion, schemaVersion, connectivityModel, supportedCapabilities?, supportedControlOperations?, s2sAuthPolicy? }` |
| PATCH | `/control-contracts/:id` | manage | draft only |
| POST | `/control-contracts/:id/transition` | `platform:product_control_contracts:certify` | `{ toStatus, reason? }` |

## Compatibility & history

| Méthode | Path | Permission | Body / notes |
|---------|------|------------|--------------|
| POST | `/compatibility/evaluate` | `platform:registry_compatibility:evaluate` | `{ productRegistryId, technicalVersionId, platformId, environmentId, profileId, contractId, correlationId? }` |
| GET | `/compatibility/evaluations` | evaluate | liste |
| GET | `/compatibility/evaluations/:id` | evaluate | détail |
| GET | `/history` | `platform:registry_history:read` | query: resourceType?, resourceId? |

## Erreurs domaine typiques

| Code | Cas |
|------|-----|
| `RESOURCE_NOT_FOUND` | id inconnu |
| `CONFLICT` | produit déjà enregistré |
| `INVALID_STATE_TRANSITION` | transition / mutation interdite |
| `VALIDATION_ERROR` | reason manquante sur transition sensible |
| `DEPENDENCY_UNAVAILABLE` | audit durable impossible |

## Non-objectifs API

Aucun endpoint P7.2 ne crée de tenant, ne provisionne une DB, ne configure Keycloak, ni ne déclenche un runtime deploy.
