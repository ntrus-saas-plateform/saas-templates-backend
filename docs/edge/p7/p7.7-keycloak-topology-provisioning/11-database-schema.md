# P7.7 — Database Schema (migration 102)

**File:** `migrations/control-plane/102_edge_p7_keycloak_topology_provisioning.sql`
**Tables:** 14 (`edge_p7_keycloak_*`) — asserted by the DB integration suite against `information_schema`.
**Secret rule:** secrets exist **only** as opaque `credential_ref` columns (`sec_…`); plaintext secret/password columns are rejected by a schema-guard test.

## Tables

| # | Table | Purpose | Key columns |
|---|-------|---------|-------------|
| 1 | `edge_p7_keycloak_providers` | Provider capability declarations (seeded `keycloak-managed-v1`) | `code` (unique), `provider_kind`, `operational_status`, `supported_topology_types`, `capabilities`, `constraints` (`noBusinessUsers`, `noBusinessRoles`, `externalTopologyRequiresCertification`) |
| 2 | `edge_p7_keycloak_servers` | Registered target servers | `base_url`, `admin_realm`, `admin_client_id`, **`admin_credential_ref`**, `tls_mode`, `allow_private_network`, `environment`, `discovered_version`, `last_connectivity_*`, `version` |
| 3 | `edge_p7_keycloak_capabilities` | Verified feature matrix per server | `server_id` (unique), `keycloak_version`, `organizations_supported`, `realms_supported`, `admin_api_reachable`, `discovery_source`, `raw_evidence`, `verified_at` |
| 4 | `edge_p7_keycloak_topologies` | Desired-state root (one per tenant/product/server) | `tenant_id`, `product_id` (FK `edge_products`), `authorization_id/version`, `placement_decision_id`, `deployment_profile_id`, `topology_type` (CHECK A/B/C), `realm_ref`/`organization_ref`/`oidc_configuration_ref` (internal UUIDs), `external_realm_id`/`external_organization_id`, `desired_config_version`, `applied_config_version`, `resource_fingerprint`, `status` (12-value CHECK), `workflow_id`, `deletion_protection`, `version` |
| 5 | `edge_p7_keycloak_topology_versions` | Immutable desired snapshots | `topology_id + version_number` (unique), `fingerprint` (unique), `snapshot`, `validation_status`, `validation_errors` |
| 6 | `edge_p7_keycloak_realms` | Technical realm resources | `realm_name` (unique, Edge-derived), `external_realm_id`, `managed_by_edge`, `ssl_required`, `sso_session_idle_seconds`, `sso_session_max_seconds`, `access_token_lifespan_seconds`, `revoke_refresh_token`, `refresh_token_max_reuse`, `desired_fingerprint`, `applied_fingerprint`, `status` |
| 7 | `edge_p7_keycloak_organizations` | **Technical** organizations (Model B) | `realm_id` FK, `org_alias` (unique per realm), `org_name`, `external_organization_id`, `technical_purpose`, `status` |
| 8 | `edge_p7_keycloak_clients` | Contract-declared technical clients | `client_id` (unique per realm), `client_kind`, `owner_function`, `documented_usage`, `redirect_uris`, `web_origins`, `scopes`, **`secret_credential_ref`**, `secret_rotated_at`, `pkce_required`, `compliance_status`, `status` |
| 9 | `edge_p7_keycloak_oidc_configurations` | Discovery-validated endpoint bundles | `issuer` (unique), `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint`, `end_session_endpoint`, `supported_*` arrays, `discovery_document`, `discovery_validated`, `jwks_validated`, `status` |
| 10 | `edge_p7_keycloak_resource_references` | Internal ↔ external bindings | `resource_kind` (5 values), `internal_ref`, `external_id`, `verified`/`verified_at`; unique triple |
| 11 | `edge_p7_keycloak_health_checks` | Health/capability probe results | `topology_id`?, `server_id`, `check_type`, `outcome` (4 values), `latency_ms`, `details`, `checked_at` |
| 12 | `edge_p7_keycloak_reconciliation_runs` | Desired vs observed | `trigger` (MANUAL/SCHEDULED/DRIFT_DETECTED/WORKFLOW), `observed_state`, `drift_detected`, `drift_classification`, `drift_details`, `action_taken`, `outcome` (PENDING/NO_DRIFT/REMEDIATED/QUARANTINED/FAILED) |
| 13 | `edge_p7_keycloak_provisioning_history` | Immutable lifecycle trail | `resource_type`, `resource_id`, `from_status`/`to_status`, `action`, `reason`, `actor_id`, `details` |
| 14 | `edge_p7_keycloak_operation_evidence` | Proof of real operations (redacted) | `workflow_id`, `step_key`, `operation`, `outcome` (SUCCEEDED/FAILED/SKIPPED), `evidence` (must NOT contain secrets), `error_code`/`error_message`, `duration_ms`, `performed_by` |

## Constraints & safety

| Mechanism | Effect |
|-----------|--------|
| `uq_edge_p7_keycloak_topologies_active` (partial unique on tenant+product+server WHERE `status <> 'DEPROVISIONED'`) | One active topology per tenant/product/server (`TOPOLOGY_COLLISION` at DB level) |
| `version INTEGER >= 1` + optimistic locking in `PgKeycloakRepository` | Stale updates throw (verified in DB suite) |
| FKs `ON DELETE RESTRICT` (providers/servers/products/profiles) | Core references cannot vanish under a topology |
| FKs `ON DELETE CASCADE` (realms/orgs/clients/oidc/references/health/runs/evidence) | Topology removal cascades child rows |
| CHECK enums | Status/type drift impossible from SQL |
| `deletion_protection BOOLEAN DEFAULT TRUE` | No auto-delete without ownership proof |
| Secrets columns end in `_ref` / `_rotated_at` only | Schema-guard test asserts no plaintext secret column |

## Permissions (same migration)

7 × `platform:keycloak:*` inserted into `edge_permissions` (conflict-safe), granted to `EDGE_PLATFORM_SUPER_ADMIN` (all) and `EDGE_PLATFORM_OPERATOR` (read, reconcile, history:read, capabilities) via `edge_role_permissions`. Registered in `schema_migrations` as `102_edge_p7_keycloak_topology_provisioning`.

## Secret columns inventory (the only credential-shaped columns)

| Table | Column | Content |
|-------|--------|---------|
| `edge_p7_keycloak_servers` | `admin_credential_ref` | Vault ref for the admin service-account secret |
| `edge_p7_keycloak_servers` | `metadata` | May carry non-secret config only (tests assert no secret material) |
| `edge_p7_keycloak_clients` | `secret_credential_ref` | Vault ref for the client secret |
| `edge_p7_keycloak_clients` | `secret_rotated_at` | Rotation timestamp (no value) |

Anything else named `secret`/`password`/`credential` in `edge_p7_keycloak_servers` or `edge_p7_keycloak_clients` fails the schema-guard test unless it ends in `_ref` / `_rotated_at`.

## Boundary note

Migration header states it explicitly: **no business IAM** (no tenant end-users/roles/memberships/invitations) and **no tenant activation** (P7.8+).
