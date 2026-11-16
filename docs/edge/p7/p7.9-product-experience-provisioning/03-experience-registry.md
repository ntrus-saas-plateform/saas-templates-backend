# P7.9 — Experience Registry

## Registry objects

1. **Profiles** — product-scoped experience blueprints with compatible runtime / deployment profile codes.
2. **Applications** — typed apps (`ApplicationKind`) optionally linked to a profile; draft manifest becomes an immutable version on publish.
3. **Application versions** — checksummed manifests; may reference `configurationBundleCode` / `entitlementSnapshotVersion` as opaque version labels (P7.9 does not grant entitlements from these fields).

## Lifecycle rules

- Create profile / application requires `platform:experience:manage`.
- Publish profile/application uses optimistic concurrency (`expectedVersion`).
- Published application versions are immutable; new versions supersede prior numbers.
- Assignment requires a P7.1 `provisioningRequestId` and a validated `desiredManifest`.
- If an `experienceProfileId` is supplied at assign time, that profile must be **PUBLISHED**.

## Desired manifest (assignment)

| Field | Meaning |
|-------|---------|
| `applications[]` | `{ applicationId, applicationVersion }` — provision binds published versions |
| `clients[]` | Technical OIDC specs: redirects, origins, optional `credentialRef` (vault only) |
| `domains[]` | Hostnames + `domainKind` (`SUBDOMAIN` / `CUSTOM`); optional `platformAttested` |

Plaintext secret-like keys are rejected at assign validation (`SECRET_PLAINTEXT_FORBIDDEN`).

## Assignment fields of interest

| Field | Meaning |
|-------|---------|
| `desiredManifest` / `appliedManifest` | Wanted vs last successfully verified apply |
| `appliedChecksum` | SHA-256 over canonical desired/applied manifest |
| `authorizationRowId` / `authorizationVersion` | Bound P7.1 identity |
| `provisioningRequestId` | P7.1 request used for fail-closed revalidation |
| `workflowId` | Active / last P7.4 workflow |
| `driftStatus` | Reserved drift field |

## Uniqueness

At most one active assignment per `(tenant_id, product_id)` while status is `ASSIGNED` | `PROVISIONING` | `READY` (partial unique index).

## Console mapping

API surface under `/edge/experience/...`. Read gated by `platform:experience:read` (history by `…:history:read`). No dedicated frontend module is claimed in this pack unless present in the tree.
