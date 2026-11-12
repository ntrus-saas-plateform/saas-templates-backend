# P7.7 — Keycloak Provider Contract

**Port:** `src/modules/edge/domain/keycloak-topology/keycloak-provider.port.ts` (`KEYCLOAK_PROVIDER_PORT`)
**Certified implementation:** `HttpKeycloakAdminAdapter` (`infrastructure/keycloak/keycloak-admin.adapter.ts`), provider code `keycloak-managed-v1`

Every method speaks to the **real Keycloak Admin API** (service account, OAuth2 `client_credentials`, TLS, timeouts, controlled retries). No method simulates a result.

## `KeycloakAdminConnection` (input, no secrets inlined)

| Field | Notes |
|-------|-------|
| `baseUrl` | Registered origin — the ONLY target the adapter may call |
| `adminRealm` / `adminClientId` | Service-account identity (default realm `master`) |
| `adminCredentialRef` | Opaque vault reference; resolved per request, never persisted |
| `tlsMode` | `REQUIRED` \| `OPTIONAL_INSECURE_LOCAL` (loopback lab only) |
| `allowPrivateNetwork` | Operator attestation, non-production |
| `timeoutMs` / `maxRetries` | Defaults 10 000 ms / 2 retries |

## Methods

| Method | Purpose | Guarantees |
|--------|---------|-----------|
| `discoverCapabilities` | `GET /admin/serverinfo` + organizations probe | Version + feature matrix; failure ⇒ `adminApiReachable: false` |
| `realmExists` | `GET /admin/realms/{realm}` | 404 ⇒ `exists: false`; 2xx ⇒ fingerprint of observed settings |
| `createRealm` | `POST /admin/realms` | **Reconcile-before-create**; 409 ⇒ re-probe and adopt; token invalidated after create |
| `updateRealmSettings` | `PUT /admin/realms/{realm}` | Merges observed settings; refuses missing realm |
| `organizationExists` | `GET /admin/realms/{realm}/organizations?bc=` | 404/405 ⇒ unsupported/disabled (never a transport error) |
| `createOrganization` | `POST /admin/realms/{realm}/organizations` | Reconcile-before-create; 409 ⇒ adopt |
| `clientExists` | `GET /admin/realms/{realm}/clients?clientId=` | Exact match; returns redirect URIs + service-account flag |
| `createTechnicalClient` | `POST .../clients` (+ secret fetch) | Reconcile-before-create; **secret returned ONCE** (idempotent re-create returns no secret) |
| `getOpenidConfiguration` | `GET /realms/{realm}/.well-known/openid-configuration` | Public endpoint; URL built only from registered origin |
| `health` | Token mint | `{ ok, latencyMs, details }`; error text redacted |

## `KeycloakTopologyTarget` (adapter input)

| Field | Notes |
|-------|-------|
| `topologyId`, `tenantId`, `topologyType` | Internal identity (UUIDs, enum) |
| `realmName` | **Edge-derived** (`deriveRealmName`), never free-form user input |
| `organizationAlias?`, `organizationName?` | Model B only; `deriveOrgAlias(tenantId)` |
| `realmSettings?` | Declarative settings from P7.2 profile options |
| `clientSpecs?` | Contract-declared technical clients (id, kind, owner, redirects, origins, scopes) |
| `expectedFingerprint` | Desired-state fingerprint used by drift comparison |

## Observations (adapter → domain)

| Type | Fields |
|------|--------|
| `KeycloakRealmObservation` | `exists`, `realmName`, `externalId`, `fingerprint`, `settings?` |
| `KeycloakOrganizationObservation` | `exists`, `externalId`, `alias` |
| `KeycloakClientObservation` | `exists`, `clientId`, `externalId`, `redirectUris`, `serviceAccountEnabled` |

Internal refs (Edge UUIDs) and external ids (Keycloak) stay **distinct** — `externalRealmId` never replaces `realmRef`.

## Adapter guarantees

| Guarantee | Implementation |
|-----------|----------------|
| SSRF confinement | `assertSameOrigin()`: target must keep the registered hostname/port; scheme must be `https:` (or `http:` on loopback); discovery URLs are built internally, never caller-supplied |
| Secrets from vault only | Token mint resolves `adminCredentialRef` through `SecretsProviderPort`; no secret field is written to PostgreSQL |
| Idempotency | Every create is preceded by an existence probe; 409 ⇒ re-probe and adopt; per-key in-flight de-dup (`exclusive()`) |
| Timeouts / retries | `AbortController` timeout, bounded exponential backoff on 408/425/429/5xx and transport errors (max 2 by default) |
| Error classification | Errors mapped to `KeycloakErrorCode` by the executor; `SSRF`-shaped messages ⇒ `SSRF_BLOCKED`, timeouts ⇒ `TIMEOUT` |
| Redaction | `redactSensitive()` scrubs `Bearer …`, `client_secret=…`, JSON `client_secret` from logs/errors/evidence |
| Keycloak 26 field compat | `buildRealmPayload` / `settingsOf` use `ssoSessionIdleTimeout` / `ssoSessionMaxLifespan` |
| Token freshness | `invalidateToken(conn)` after realm creation (composite `admin` role is expanded at mint time) |
