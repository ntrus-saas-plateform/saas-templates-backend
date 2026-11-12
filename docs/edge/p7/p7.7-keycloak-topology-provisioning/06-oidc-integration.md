# P7.7 — OIDC Integration

**Code:** `keycloak.configure_oidc` and `keycloak.create_technical_client` (live executor), `getOpenidConfiguration` / `createTechnicalClient` (adapter).

## OIDC configuration records

`keycloak.configure_oidc` fetches the realm discovery document and persists it in `edge_p7_keycloak_oidc_configurations`:

| Column group | Content |
|--------------|---------|
| Endpoints | `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint`, `end_session_endpoint` |
| Capabilities | `supported_scopes`, `supported_response_types`, `supported_signing_algs` (from `scopes_supported`, `response_types_supported`, `id_token_signing_alg_values_supported`) |
| Validation | `discovery_document` (redacted copy), `discovery_validated`, `jwks_validated`, `validated_at`, `status` |

### Discovery endpoint usage (anti-SSRF)

- URL is **always** built from the registered connection origin: `/realms/{realm}/.well-known/openid-configuration`, path-encoded, then passed through `assertSameOrigin()`.
- No caller-supplied endpoint URL is ever accepted (mandate §10).
- Missing `issuer` / `token_endpoint` / `jwks_uri` ⇒ step fails `DISCOVERY_INVALID` (evidence recorded).
- **Issuer coherence check:** `issuer` must start with `{registeredBaseUrl}/realms/` — otherwise the step fails (`DISCOVERY_INVALID`), blocking redirect-to-hostile-issuer attacks.

`jwks_validated` is set by `keycloak.verify_topology` (real `GET jwks_uri`, keys array non-empty). Topology reaches `READY` only when realm exists **and** JWKS validated; otherwise `DEGRADED` (`jwks-unverified`).

Live proof: `edge-keycloak-live.spec.ts` asserts a real discovery document for the provisioned realm (issuer contains `/realms/{realm}`, authorization + token endpoints present).

## Technical clients

Clients exist **only when declared by the deployment contract** (`profileOptions.clientSpecs`); no declared client ⇒ step records `SKIPPED` (`no-declared-client`, mandate §9: no arbitrary clients). `POST edge/keycloak/clients` only appends a declaration to a new workflow — it never writes to Keycloak directly.

### Policy enforced before create (`validateRedirectUris` / `validateWebOrigins`)

| Rule | Rejected examples |
|------|-------------------|
| No trailing wildcards / wildcard host | `https://app.example.com/*`, `https://*` |
| No template syntax | `{{…}}`, `{…}` |
| Scheme: `https://`, `http://`, or `urn:ietf:wg:oauth:2.0:oob` | `javascript:alert(1)` |
| No incomplete URIs | `http://`, `https://` |
| Web origins: no `*`, `null`, wildcard | `*`, `null`, `https://*` |

Violation ⇒ step `FAILED` with `VALIDATION` and evidence listing the offending values.

### Creation guarantees (adapter)

- Payload: `standardFlowEnabled: true`, `directAccessGrantsEnabled: false`, `implicitFlowEnabled: false`, PKCE `S256` attribute, `post.logout.redirect.uris` from declared redirects, `serviceAccountsEnabled` for `CONFIDENTIAL`/`SERVICE_ACCOUNT`.
- Reconcile-before-create; 409 ⇒ adopt.
- **Secret ONCE:** for `CONFIDENTIAL` clients the secret is fetched right after create and returned in the create result only. Idempotent re-create returns `{ externalId, observation }` **without** a secret — no re-issue, no log leak.
- The executor immediately stores the secret via `SecretsProviderPort.put({ kind: 'keycloak-client-secret', … })` and keeps only `secret_credential_ref` in PostgreSQL (`secret_rotated_at` timestamp). If a ref already exists, no new fetch is required.

Live proof: confidential client create returns a non-trivial secret on first call; second call returns the same external id and `clientSecret === undefined`.

## Frontend reference

`saas-template-frontend/lib/keycloak/pkce-action.ts` implements the browser side for the **platform-web public client**: SHA-256 PKCE pair (`createPkcePair`), one-shot verifier storage in `sessionStorage` (`storePkceVerifier` / `takePkceVerifier`), and Keycloak `kc_action` URLs (`CONFIGURE_TOTP`, `UPDATE_PASSWORD`, webauthn registration, recovery codes) built from `NEXT_PUBLIC_KEYCLOAK_URL` / `NEXT_PUBLIC_KEYCLOAK_REALM` / `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`. P7.7 does not modify it; it documents the client-side counterpart of the redirect/origin rules above (redirect URIs must match what this flow uses).
