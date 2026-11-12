# P7.7 — Security Hardening

**Suite:** `test/security/edge-keycloak-security.spec.ts` (12 tests, executed 2026-11-12 — see `12-test-evidence.md`).

## Controls

### 1. SSRF origin confinement (`assertSameOrigin`)

| Rule | Effect |
|------|--------|
| Target host/port must equal the registered `conn.baseUrl` host/port | Any URL escaping the registered origin throws (`Keycloak endpoint escapes registered server origin`) |
| Scheme must be `https:` — `http:` allowed only on loopback (`localhost` / `127.0.0.1` / `::1`) | `http://kc.corp.example` ⇒ rejected |
| Discovery/admin URLs are built internally; realm names are path-encoded | Hostile realm names (`https://evil.example.net/steal`, `//evil.example.net/steal`, `../../admin/realms`) stay on the registered origin |
| Endpoints are never taken from frontend input | Controller DTOs carry no endpoint URLs |

Verified live: hostile realm names against a real Keycloak 26.0.7 container produce `404` **on the registered server**, never a request to another host.

### 2. Secret handling

| Control | Where |
|---------|-------|
| PostgreSQL stores only opaque `credential_ref` (`sec_…`) | migration 102 columns `admin_credential_ref`, `secret_credential_ref` |
| Secrets vault required — registration **fails** (`DEPENDENCY_UNAVAILABLE`) when no vault is wired | `RegisterKeycloakServerUseCase` |
| `redactSensitive()` scrubs `Bearer …`, `client_secret=…`, JSON `client_secret` | adapter (logs, errors, evidence) |
| `redactSecrets()` masks `secret`, `password`, `credential`, `token`, `adminCredentialRef` keys | use cases (events, snapshots, API payloads) |
| Audit details mask the credential ref | `p7.keycloak.server.registered` |
| Schema guard test rejects plaintext secret/credential columns | DB integration suite |

### 3. Fencing tokens

`isValidFencingToken()` in `keycloak-handlers.ts`: `typeof number && Number.isInteger && >= 1`. Invalid tokens (0, negative, `null`, non-numeric) fail the step **before** the live executor runs; the same check guards `compensate()`. Verified by security tests: executor untouched on stale/missing token.

### 4. P7.1 authorization fail-closed

- `validateResourcePlan` rejects invalid/expired/revoked authorization and missing placement.
- `RequestKeycloakProvisioningUseCase` refuses provisioning without a `provisioningRequestId`.
- `LaunchTopologyWorkflowUseCase` refuses when the topology has no bound authorization.
- Workflow step `keycloak.validate_plan` re-checks persisted state (revoked/expired flags ⇒ step failure).
- Controller endpoints are guarded by `EdgeAuthGuard` + `EdgePermissionGuard` with `platform:keycloak:*` permissions.

### 5. Keycloak 26 hardening notes

- Exact KC 26 `RealmRepresentation` field names (defect #1) — avoids HTTP 400 and ensures settings actually apply.
- Token invalidation after realm create (defect #3) — realm-scoped calls never run on a stale token.
- Provisioned realms: `registrationAllowed=false`, `userManagedAccessAllowed=false`, `revokeRefreshToken=true`, `refreshTokenMaxReuse=0`, `sslRequired=external` default.
- Clients: PKCE S256 enforced, implicit flow disabled, direct access grants disabled, wildcards/`null` origins rejected.

## Defects found & fixed during P7.7

| # | Defect | Evidence source | Fix |
|---|--------|-----------------|-----|
| 1 | KC 26 rejected realm create (HTTP 400 `unable to read contents from stream`) with `ssoSessionIdle` / `ssoSessionMax` fields | Live create attempt against KC 26.0.7 | `buildRealmPayload()` / `fingerprintRealm()` use `ssoSessionIdleTimeout` / `ssoSessionMaxLifespan` |
| 2 | Fencing token `0` / negative / `null` was not rejected (stale worker could act) | Unit/security review of handler guard | `isValidFencingToken()` — integer `>= 1`, fail-closed in execute **and** compensate |
| 3 | **Live-only:** cached admin token minted before realm creation lacked the new realm's `<realm>-realm` admin roles ⇒ realm-scoped calls (GET clients, GET organizations) returned 403 while fresh mints returned 200 | Live suite failure (`createRealm` → `clientExists` 403) | `invalidateToken(conn)` after successful create, before the post-create probe |
| 4 | Frontend test crashed: jsdom lacks `scrollIntoView` | Frontend vitest run | `beforeAll` polyfill in `edge-keycloak-module.test.tsx` |

## Residual risks (summary — full model in `13-security-review.md`)

- Plain HTTP remains possible for loopback lab servers under `allowPrivateNetwork` attestation (non-production only, enforced at registration).
- Evidence/audit content is redacted by convention + tests, not by a schema-level JSON scanner.
