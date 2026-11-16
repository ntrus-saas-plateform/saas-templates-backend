# P7.8 — Domain Model

## Aggregates

| Aggregate | Role |
|-----------|------|
| **ConfigurationSchema** | Immutable JSON Schema version (`code` + `schemaVersion`), checksummed |
| **ConfigurationTemplate** | Draftable parent + immutable published versions validated against schema |
| **ConfigurationBundle** | Deployable unit aggregating template version refs + optional dependencies |
| **TenantConfigurationAssignment** | Desired/applied config for a tenant×product, drift + entitlement refs |
| **EntitlementDeployment** | Applied capabilities / flags / quotas / limits with digest + status |
| **ConfigurationDeploymentRun** | One deploy/rollback/reconcile attempt with outcome + evidence |
| **ConfigurationEvidence** | Durable step-level evidence (redacted) |

## Status machines (summary)

**Schema:** `DRAFT → ACTIVE → DEPRECATED → RETIRED`

**Template / Bundle:** `DRAFT → VALIDATED → PUBLISHED → DEPRECATED → RETIRED`

**Assignment:** `ASSIGNED → DEPLOYING → DEPLOYED | FAILED`; rollback path `ROLLBACK_PENDING → ROLLED_BACK`; may become `SUPERSEDED`

**Entitlement deployment:** `PENDING → VALIDATING → DEPLOYING → DEPLOYED | FAILED`; may `SUSPENDED` / `REVOKED` / `SUPERSEDED`

**Drift:** `NONE | DETECTED | REMEDIATING | RESOLVED | UNKNOWN`

## Entitlement kinds

`COMMERCIAL_ENTITLEMENT` | `TECHNICAL_CAPABILITY` | `FEATURE_FLAG` | `OPERATIONAL_CONFIGURATION` | `CAPACITY_LIMIT` | `USAGE_QUOTA`

Commercial entitlements never expand beyond the P5 granted snapshot attached at assignment time.

## Strategies

`ATOMIC` (default) | `ROLLING` | `CANARY` | `BLUE_GREEN` | `STAGED` — recorded on assignment / run; executor currently focuses on atomic local apply.

## Error codes (selected)

`VALIDATION`, `AUTHORIZATION_FAILED`, `SCHEMA_INVALID`, `CHECKSUM_MISMATCH`, `ENTITLEMENT_EXPANSION`, `ENTITLEMENT_REVOKED`, `BUNDLE_NOT_PUBLISHED`, `SECRET_PLAINTEXT_FORBIDDEN`, `ROLLBACK_FORBIDDEN`, `DRIFT_DETECTED`, `IDEMPOTENT_REPLAY`, `CONFLICT`.

## Persistence

Tables under migration **103** (`edge_p7_configuration_*`, `edge_p7_entitlement_deployments`, runs, evidence). Permissions seeded in the same migration.
