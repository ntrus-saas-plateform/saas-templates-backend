# P7.7 — Realm Provisioning (Model A / shared realm for Model B)

**Code:** `HttpKeycloakAdminAdapter.createRealm` + `keycloak.provision_realm` branch of `live-keycloak.executor.ts`

## Idempotency: reconcile-before-create

1. `realmExists()` — `GET /admin/realms/{realm}` on the registered origin.
2. If it exists → **re-adopt**: return the observation (`exists: true`, `externalId`, observed `fingerprint`); no second POST.
3. If not → `POST /admin/realms` with `buildRealmPayload(target)`.
4. HTTP **409** (concurrent create) → re-probe; if now present, adopt the winner; only an unresolved conflict throws.
5. Any other non-2xx → classified error (`redactSensitive` applied to the response body excerpt).
6. Post-create: `invalidateToken(conn)` → `realmExists()` again; missing realm ⇒ error (no silent success).

A network error after a create therefore never triggers a blind second create: the next attempt starts with the existence probe.

## Payload build (`buildRealmPayload`)

| Keycloak field | Value / source |
|----------------|----------------|
| `realm` | Edge-derived `realmName` |
| `enabled` | `true` |
| `registrationAllowed` | `false` (no self-registration in Edge-provisioned realms) |
| `loginWithEmailAllowed` / `duplicateEmailsAllowed` / `resetPasswordAllowed` / `editUsernameAllowed` | `true` / `false` / `false` / `false` |
| `sslRequired` | profile setting, default `external` |
| `ssoSessionIdleTimeout` | default 1800 s |
| `ssoSessionMaxLifespan` | default 36000 s |
| `accessTokenLifespan` | default 300 s |
| `revokeRefreshToken` / `refreshTokenMaxReuse` | `true` / `0` by default |
| `offlineSessionIdleTimeout`, `passwordPolicy` | only when declared |
| `userManagedAccessAllowed` | `false` (hardening default) |

Legacy input names (`ssoSessionIdle`, `ssoSessionMax`, `offlineSessionIdle`) are accepted from `realmSettings` and normalized.

## Keycloak 26 field mapping (defect #1, fixed)

Keycloak **26 rejects unknown `RealmRepresentation` fields** with HTTP 400 `unable to read contents from stream`. Keycloak ≤ 24 accepted `ssoSessionIdle` / `ssoSessionMax`; KC 26 requires `ssoSessionIdleTimeout` / `ssoSessionMaxLifespan`.

- `buildRealmPayload()` sends only KC-26-valid names (normalizing legacy input).
- `fingerprintRealm()` / `settingsOf()` read the same KC-26 names so observed-state fingerprints match what was written.
- Effect: realm create no longer fails with HTTP 400 on KC 26; regression covered indirectly by the live suite (realm create against `quay.io/keycloak/keycloak:26.0.7`).

## Token invalidation after create (defect #3, live-only)

Keycloak expands the composite `admin` role **at token mint time**. A service-account token minted *before* a realm exists does not carry the new realm's admin client roles (`<realm>-realm` in `resource_access`), so every realm-scoped call made with that cached token returns **403**, even though a fresh direct mint returns 200.

Fix: `HttpKeycloakAdminAdapter.invalidateToken(conn)` is called immediately **after a successful realm create** and **before** the post-create verification probe (`realmExists`). This defect was found by the live suite (`createRealm` → `clientExists` 403) and does not reproduce in mocked/unit tests.

## Persistence after create (executor)

| Step | Record |
|------|--------|
| Realm row | `edge_p7_keycloak_realms` (`managed_by_edge = true`, settings, desired/applied fingerprints) |
| Resource reference | `edge_p7_keycloak_resource_references` (`REALM`, internal UUID ↔ external id) — unique constraint ⇒ re-run binds once |
| Topology update | `realmRef`, `externalRealmId`, status → `CONFIGURING` (optimistic version; concurrent-advance tolerated) |
| Existing realm with changed fingerprint | `updateRealmSettings()` (PUT merge) |
| Evidence | `operation_evidence` row `provision_realm` (`SUCCEEDED`, `preexisting` flag) |
