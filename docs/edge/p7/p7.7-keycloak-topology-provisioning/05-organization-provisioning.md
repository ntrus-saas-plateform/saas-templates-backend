# P7.7 — Organization Provisioning (Model B)

**Code:** `HttpKeycloakAdminAdapter.organizationExists` / `createOrganization` + `keycloak.provision_organization` branch of the live executor.

Model B isolates tenants inside a shared realm using **Keycloak Organizations** (feature `organization`, Keycloak 26). The organization Edge creates is a **technical** object (`technical_purpose = 'tenant-identity-infrastructure'`) — it is *not* a business organization, holds no business memberships, and Edge stores no tenant end-users.

## Capability probe (feature must be verified, never assumed)

`discoverCapabilities()` runs `GET /admin/serverinfo` (version) and then `probeOrganizations()`:

| Probe result | Interpretation |
|--------------|----------------|
| `404` / `405` / `501` | Organizations endpoint absent ⇒ `organizationsSupported = false` |
| `401` / `403` | Endpoint exists but permissions limited ⇒ supported |
| `2xx` | Supported (probe `GET /organizations?max=1` succeeded) |
| transport error | `false` (fail-closed) |

Version gating (`≥ 26.0`) only applies when the explicit feature list is not exposed. The result is persisted in `edge_p7_keycloak_capabilities` (`organizations_supported`, `discovery_source`, `raw_evidence`, `verified_at`).

**Gates using the probe:**

- Plan validation: `SHARED_REALM_ORGANIZATIONS` without `organizationsSupportedByServer` ⇒ `CAPABILITY_UNSUPPORTED`.
- Workflow step `keycloak.validate_plan`: Model B + unverified capability ⇒ step failure (evidence `validate_plan / FAILED`).
- Step `keycloak.provision_organization`: capability missing ⇒ `CAPABILITY_UNSUPPORTED` — *"no silent compatibility"*.

## Create / verify (idempotent)

1. `organizationExists(conn, realm, alias)` — `GET /admin/realms/{realm}/organizations?bc={alias}`; match on `alias` or `name`; 404/405 ⇒ `exists: false`.
2. Not exists ⇒ `POST /admin/realms/{realm}/organizations` with `{ name, alias }`.
3. **409** ⇒ re-probe and adopt the winner.
4. Non-2xx ⇒ classified error (redacted body excerpt).
5. Post-create re-probe: organization not visible ⇒ error (no silent success).
6. Per-key in-flight de-dup (`exclusive('org:{realm}:{alias}')`) prevents concurrent double-create.

## Alias rules

| Rule | Value |
|------|-------|
| Derivation | `deriveOrgAlias(tenantId)` → `t-<first 12 hex chars of tenantId without dashes>` (lowercase) |
| Pattern | `^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$` (validated in `validateResourcePlan`) |
| Source of truth | `metadata.resolvedOrgAlias` on the topology; executor falls back to `deriveOrgAlias(tenantId)` |
| Free-form input | Rejected — alias never comes from raw user input |

## Persistence (executor)

| Record | Content |
|--------|---------|
| `edge_p7_keycloak_organizations` | `org_alias`, `org_name` (`tenant <id> (technical)`), `external_organization_id`, `status = READY`, `evidence.preexisting` |
| `edge_p7_keycloak_resource_references` | `ORGANIZATION` internal UUID ↔ external id (unique ⇒ re-run binds once) |
| `edge_p7_keycloak_topologies` | `organization_ref`, `external_organization_id` |
| `operation_evidence` | `provision_organization` — `SUCCEEDED` / `SKIPPED` / `FAILED` |

Non-Model-B topologies record `provision_organization` as **`SKIPPED`** with reason — an honest no-op, not a fabricated success.

## Honest test status

- The live suite (`edge-keycloak-live.spec.ts`, Keycloak 26.0.7 started with `--features=organization`) exercises **only the probe**: `organizationExists()` must return a boolean without a transport error.
- `createOrganization()` (end-to-end org creation) is **not exercised by any executed live test** — see `12-test-evidence.md` and `15-acceptance-report.md`.
