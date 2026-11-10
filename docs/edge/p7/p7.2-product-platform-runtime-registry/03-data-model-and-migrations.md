# P7.2 — Modèle de données & migrations

## Migration

| Champ | Valeur |
|-------|--------|
| Fichier | `migrations/control-plane/096_edge_p7_product_platform_runtime_registry.sql` |
| Version enregistrée | `096_edge_p7_product_platform_runtime_registry` (insert `schema_migrations`) |
| Exécution runtime | **Non vérifiée dans ce pack** — fichier présent ; apply à confirmer en environnement |

## Tables créées

| Table | Rôle |
|-------|------|
| `edge_p7_product_registry` | Registre technique produit (FK `edge_products`) |
| `edge_p7_product_technical_versions` | Versions techniques |
| `edge_p7_product_platforms` | Plateformes (FK optionnelle `edge_business_backends`) |
| `edge_p7_runtime_environments` | Environnements runtime (FK plateforme) |
| `edge_p7_deployment_profiles` | Profils de déploiement (codes canoniques) |
| `edge_p7_product_control_contracts` | Contrats de contrôle produit↔plateforme |
| `edge_p7_compatibility_evaluations` | Résultats d’évaluation (audit) |
| `edge_p7_registry_history` | Historique unifié append-only |

## Points saillants par table

### `edge_p7_product_registry`

- `UNIQUE(product_id)`, `UNIQUE(code)`
- Status : `registry_status`, `certification_status`, `provisionable`
- CHECK : `provisionable` ⇒ CERTIFIED + CERTIFIED
- Compatibilité déclarée via UUID arrays (`compatible_*_ids`)
- Optimistic lock : colonne `version`

### `edge_p7_product_technical_versions`

- `UNIQUE(product_registry_id, technical_version)`
- Channels : DEV / BETA / STABLE / LTS / HOTFIX
- JSONB : contrats/profils/runtime compat, schema/api compatibility
- `immutable_after_publish` (défaut TRUE)

### `edge_p7_product_platforms`

- Types : SHARED_SAAS / DEDICATED / PRIVATE / ON_PREMISE
- `secure_config_ref` — **référence opaque uniquement**
- `allowed_product_ids`, `supported_environment_types`, `supported_profile_codes`

### `edge_p7_runtime_environments`

- Types : DEVELOPMENT / TEST / STAGING / PRODUCTION
- `UNIQUE(platform_id, code)`
- Contraintes résidence / backup / disponibilité en JSONB

### `edge_p7_deployment_profiles`

- Codes CHECK : SHARED_SAAS, DEDICATED_DATA, DEDICATED_RUNTIME, PRIVATE_CLOUD, ON_PREMISE
- Seed 096 :
  - SHARED_SAAS, DEDICATED_DATA, DEDICATED_RUNTIME → CERTIFIED + ACTIVE
  - PRIVATE_CLOUD, ON_PREMISE → UNCERTIFIED + DRAFT

### `edge_p7_product_control_contracts`

- `UNIQUE(contract_code, contract_version)`
- Immutabilité : CHECK `immutable` ⇒ status ∈ {PUBLISHED, DEPRECATED, RETIRED}
- FK `product_id` → `edge_products`, `platform_id` → platforms

### `edge_p7_compatibility_evaluations`

- `result` ∈ COMPATIBLE / INCOMPATIBLE / REQUIRES_REVIEW
- `rules_applied`, `reasons`, `examined_refs` JSONB
- FKs SET NULL à la suppression des ressources référencées

### `edge_p7_registry_history`

- `resource_type` enum multi-ressources
- Index `(resource_type, resource_id, created_at DESC)`

## Indexes principaux

- Produits : status/certification ; partial index `provisionable=TRUE`
- Versions / contrats / plateformes / envs : status
- Évaluations : `correlation_id` ; `(result, evaluated_at DESC)`
- History : ressource + temps

## Permissions seedées (096)

Voir `06-rbac-audit-events.md` — 14 permissions `platform:*` + grants SUPER_ADMIN / OPERATOR.

## Notes d’application

1. Migration **idempotente** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
2. Dépend de tables préexistantes : `edge_products`, `edge_business_backends`, `edge_permissions`, `edge_roles`, `edge_role_permissions`, `schema_migrations`.
3. **Ne pas marquer PASS** sur l’exécution migrate tant que non confirmée sur l’environnement cible.
