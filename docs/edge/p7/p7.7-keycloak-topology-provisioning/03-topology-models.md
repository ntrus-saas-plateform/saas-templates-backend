# P7.7 — Topology Models

## The three mandated models

| Model | `KeycloakTopologyType` | When it applies | What Edge provisions |
|-------|------------------------|-----------------|----------------------|
| **A** | `DEDICATED_REALM` | One isolated realm per tenant/product (default) | Realm (`okapi-t-<tenant8>-p-<product8>`), OIDC discovery, declared technical clients |
| **B** | `SHARED_REALM_ORGANIZATIONS` | Shared realm, isolation via Keycloak Organizations | Realm (`okapi-shared`) + one **technical** organization (`t-<tenant12>`) |
| **C** | `EXTERNAL_SPECIFIC` | External / specific topology | **Nothing by default** — requires `profileOptions.certifiedExternalAdapter === true`; executor records `SKIPPED` evidence |

Provider seed (`keycloak-managed-v1`, migration 102) declares support for `DEDICATED_REALM` and `SHARED_REALM_ORGANIZATIONS` only. Model C fails plan validation with `TOPOLOGY_UNSUPPORTED` unless a certified adapter contract is present ("no silent compatibility").

### Model gating in the executor

| Handler | Model A | Model B | Model C |
|---------|---------|---------|---------|
| `keycloak.provision_realm` | create/adopt realm | create/adopt shared realm | `SKIPPED` (certified adapter contract) |
| `keycloak.provision_organization` | `SKIPPED` (no orgs) | requires verified `organizationsSupported`, else `CAPABILITY_UNSUPPORTED` | `SKIPPED` |
| `keycloak.create_technical_client` | contract-declared clients only | same | `SKIPPED` |

## Lifecycle statuses (mandate §12)

`PLANNED → PENDING → PROVISIONING → CONFIGURING → VERIFYING → READY`

| Status | Meaning |
|--------|---------|
| `PLANNED` | Desired-state row created and validated (or `FAILED` immediately if plan invalid) |
| `PENDING` | Bound to a P7.4 workflow instance, not yet running |
| `PROVISIONING` | Realm/organization creation in progress |
| `CONFIGURING` | OIDC + technical clients being configured |
| `VERIFYING` | Post-create verification (discovery + JWKS probe) |
| `READY` | Verified: realm exists, JWKS validated |
| `DEGRADED` | Reachable but verification incomplete (e.g. `jwks-unverified`) |
| `FAILED` | Validation or operation failure (reason persisted) |
| `RECONCILIATION_REQUIRED` | Drift detected (non-critical) |
| `QUARANTINED` | Realm missing outside Edge, or safety violation |
| `DEPROVISIONING_PENDING` / `DEPROVISIONED` | Destructive path (approval-gated) / terminal |

### State-machine rules (`keycloak-state-machine.ts`)

- Transitions are an explicit allow-list; anything else throws `VALIDATION_ERROR`.
- **Fail-closed:** `READY` is reachable only from `VERIFYING` or `READY` (`assertReadyRequiresVerification`).
- `DEPROVISIONED` is terminal (`isTerminal`); `DEPROVISIONING_PENDING`/`DEPROVISIONED` are destructive (`isDestructive`).
- `QUARANTINED` → re-provision/verify/deprovision only; `READY → PROVISIONING` allowed for re-apply.

## Plan validation and fingerprinting (`keycloak-plan.ts`)

Fail-closed gates evaluated before any workflow start:

| Gate | Error code |
|------|-----------|
| Authorization valid / not expired / not revoked | `AUTHORIZATION_FAILED` / `AUTHORIZATION_EXPIRED` / `AUTHORIZATION_REVOKED` |
| Placement decision confirmed | `PLACEMENT_INVALID` |
| Provider ACTIVE and supports topology type | `PROVIDER_UNAVAILABLE` / `TOPOLOGY_UNSUPPORTED` |
| Server ACTIVE + last connectivity not FAILED + TLS per profile | `SERVER_UNAVAILABLE` / `VALIDATION` |
| Organizations capability verified (Model B) | `CAPABILITY_UNSUPPORTED` |
| Certified adapter (Model C) | `TOPOLOGY_UNSUPPORTED` |
| Redirect/origin policy (no wildcards, no `null`, http(s) or approved urn) | `VALIDATION` |

**Naming:** realm and org alias are Edge-derived (`deriveRealmName`, `deriveOrgAlias`) — pattern `^[a-z0-9][a-z0-9-]{1,60}[a-z0-9]$`; raw user input never reaches Keycloak.

**Fingerprinting:** `computePlanFingerprint()` = SHA-256 over `{tenantId, productId, providerId, serverId, topologyType, sorted(profileOptions), sorted(metadata)}` — deterministic, secret-free, stored in `topologies.resource_fingerprint` and each `topology_versions` row. The adapter's `fingerprintRealm()` computes the observed-state fingerprint (realm, sslRequired, session settings, token lifespan, password policy) for drift comparison.
