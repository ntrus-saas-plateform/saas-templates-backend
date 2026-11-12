# P7.7 — Operations Runbook

All steps assume an authenticated Edge console/API caller with the listed `platform:keycloak:*` permission.

## 1. Register a Keycloak server — `platform:keycloak:manage`

```
POST edge/keycloak/servers
{ providerId, code, name, baseUrl, adminRealm?, adminClientId,
  adminCredential, tlsMode?, allowPrivateNetwork?, environment? }
```

- `adminCredential` is write-only → stored in the vault; response/DB keep only `credentialRef` (`sec_…`).
- Non-loopback `baseUrl` must be `https://`; `PRODUCTION` always requires TLS; `allowPrivateNetwork` only for lab targets.
- Failures: `Provider not found` / `Provider is not ACTIVE`; `Secrets vault unavailable` (vault not wired); `credentialRef or adminCredential required`.

## 2. Discover capabilities — `platform:keycloak:capabilities`

```
POST edge/keycloak/servers/:id/capabilities
GET  edge/keycloak/servers/:id/capabilities     (last verified matrix)
```

- Runs authenticated `serverinfo` + organizations probe; persists `keycloak_version`, `organizations_supported`, health row, history, audit.
- On failure the server flips to `UNAVAILABLE` / `lastConnectivityStatus = FAILED` (plan validation will then refuse provisioning).

## 3. Provision a topology — `platform:keycloak:provision`

```
POST edge/keycloak/topologies
{ tenantId, productId, provisioningRequestId, providerId, serverId,
  topologyType, profileOptions?, placementDecisionId?, deploymentProfileId?, ... }
```

- Requires a valid **P7.1** `provisioningRequestId` (fail-closed).
- Pipeline: plan validation + fingerprint → topology row (`PLANNED`) → P7.4 workflow instance → status `PENDING` → steps run:
  `validate_plan → capabilities → provision_realm → provision_organization → configure_oidc → create_technical_client → verify_topology`.
- Declare extra technical clients: `POST edge/keycloak/clients` (policy-checked, `declare_client` workflow).
- Progress: `GET edge/keycloak/topologies/:id` (status, realm, clients, oidc, evidence).

## 4. Verify a topology

- Status must reach `READY` — only possible from `VERIFYING` and only when realm exists **and** JWKS validated.
- Inspect proof: `GET …/topologies/:id/evidence` (`platform:keycloak:history:read`), `GET …/history`.
- `DEGRADED` with reason `jwks-unverified` ⇒ check `oidc.jwksUri` reachability, then re-run verification via reconcile.

## 5. Reconcile — `platform:keycloak:reconcile`

```
POST edge/keycloak/topologies/:id/reconcile   { idempotencyKey?, provisioningRequestId? }
GET  edge/keycloak/topologies/:id/reconciliations
```

| Run outcome | Topology status | Action |
|-------------|-----------------|--------|
| `NO_DRIFT` | unchanged / `DEGRADED→READY` | none |
| `REMEDIATED` | `RECONCILIATION_REQUIRED` | schedule re-apply workflow |
| `QUARANTINED` | `QUARANTINED` (`realm-missing-outside-edge`) | **manual** ownership/safety assessment — Edge never auto-recreates a deleted realm |

## 6. Deprovision — `platform:keycloak:deprovision`

```
POST edge/keycloak/topologies/:id/deprovision
{ authorized: true, confirmed: true, reason }
```

- Both flags mandatory or `DEPROVISION_FORBIDDEN` (workflow not even created).
- Handler returns `WAITING_APPROVAL` unless the snapshot carries both flags; authorized run records evidence and sets `DEPROVISIONING_PENDING` — realm deletion is deferred to retention policy.
- Compensation of any provisioning step also routes to `keycloak.deprovision_topology` (approval-gated).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| **403 on realm-scoped calls right after realm create** | Stale admin token (composite `admin` role expanded at mint time; cached token predates the realm) | **Now automatic**: adapter calls `invalidateToken()` after create — if seen, verify adapter version contains the fix (defect #3). Do NOT widen service-account roles as a workaround. |
| **400 `unable to read contents from stream` on realm create** | Field-name drift in `RealmRepresentation` (KC ≤ 24 names on KC 26) | Use `ssoSessionIdleTimeout` / `ssoSessionMaxLifespan` (defect #1 fix in `buildRealmPayload`). |
| `SSRF_BLOCKED` / `escapes registered server origin` | Requested URL/host differs from registered `baseUrl` | Correct the server registration; never pass endpoint URLs from clients. |
| `scheme not allowed: http:` | Plain HTTP on non-loopback | Use HTTPS, or loopback lab URL with `allowPrivateNetwork` + non-PRODUCTION env. |
| `CAPABILITY_UNSUPPORTED` on Model B | Organizations not verified (`serverinfo`/probe) | Enable `organization` feature on the server, re-run capabilities discovery. |
| `TOPOLOGY_UNSUPPORTED` on `EXTERNAL_SPECIFIC` | No certified adapter contract | Provide `profileOptions.certifiedExternalAdapter = true` via P7.2 contract (Model C) or use Model A/B. |
| `AUTHORIZATION_FAILED` / `AUTHORIZATION_REVOKED` | Missing/expired/revoked P7.1 provisioning request | Issue/refresh the P7.1 authorization; all P7.7 boundaries revalidate fail-closed. |
| `TOPOLOGY_COLLISION` | Active topology already exists for tenant+product+server | Deprovision the existing one or target another server. |
| Step fails `DEPENDENCY_UNAVAILABLE`, "no live executor wired" | DI missing `KEYCLOAK_LIVE_EXECUTOR` | Check `edge-application.providers.ts` wiring (never simulate success). |
| Evidence write fails | Audit/DB dependency down | Fix dependency — mutations intentionally abort when evidence/audit cannot be persisted. |
