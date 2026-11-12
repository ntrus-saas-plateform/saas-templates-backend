# P7.7 — Security Review

**Date:** 2026-11-12 · Scope: P7.7 Keycloak topology provisioning (Edge Control Plane only).

## Threat model & controls

| # | Threat | Attack surface | Control(s) | Verified by |
|---|--------|----------------|-----------|-------------|
| T1 | **SSRF** — API-driven calls to attacker host (cloud metadata, internal services) | `baseUrl`, realm names, OIDC issuer/discovery | `assertSameOrigin()` host/port/scheme check on every request; discovery URL built internally from registered origin; endpoints never from client input; non-loopback requires HTTPS; `allow_private_network` attestation for lab targets | Security suite (5 SSRF tests); live hostile-realm test (404 on registered server) |
| T2 | **Secret leakage** (DB, logs, API, evidence, events) | server/client credentials, tokens | `credential_ref`-only schema (+ schema-guard test); vault required or registration fails; `redactSensitive` on outbound text; `redactSecrets` on evidence/snapshots/events; writeOnly DTO field; audit masks ref; console masks `••••••••` | Security masking tests; DB opaque-ref test; live health/redaction tests; frontend masking test |
| T3 | **Stale-worker mutations** (split brain, out-of-order ops) | P7.4 workers | `isValidFencingToken` (integer `>= 1`) in execute **and** compensate, checked before any Keycloak call; optimistic `version` on all updates; in-flight de-dup per operation key | Security fencing tests (defect #2 fix) |
| T4 | **Unauthorized provisioning / privilege escalation** | HTTP API, workflow launch | Per-route `platform:keycloak:*` permissions (7 codes, role-scoped grants); P7.1 authorization revalidated fail-closed at create, launch and `validate_plan`; placement confirmed; deprovision needs `platform:keycloak:deprovision` + `authorized` + `confirmed` | Security P7.1 fail-closed tests (3); controller guards; DB permission seed |
| T5 | **Authorization bypass by omission** (no/revoked/expired auth) | use cases, plan validation | `revalidateAuthorization` returns fail-closed `AUTHORIZATION_REVOKED` when the workflow view is absent; `RequestKeycloakProvisioningUseCase` refuses without `provisioningRequestId`; plan validation rejects invalid/expired/revoked | Security tests (2) + unit suites |
| T6 | **Open redirect / token theft via client config** | redirect URIs, web origins | `validateRedirectUris`/`validateWebOrigins` — wildcards, `null`, templates, non-http(s) rejected; PKCE S256, implicit flow & direct grants disabled; issuer must belong to registered origin | Security redirect test; plan validation |
| T7 | **Business-IAM boundary crossing** (Edge managing tenant end-users/roles) | schema + executor | No user/membership/invitation tables or operations exist; org rows are `technical_purpose`; provider constraints `noBusinessUsers`/`noBusinessRoles`; mandate comments in migration 102 | DB suite asserts provider constraints; code review of executor |
| T8 | **Destructive operations without ownership** | deprovision path | Restricted handler key; `WAITING_APPROVAL` default; both flags required before a workflow is even created; `deletion_protection` default TRUE; realm deletion deferred to retention policy | Handler unit tests; controller DTO |
| T9 | **Simulated/false success** | workflow handlers | No live executor ⇒ `DEPENDENCY_UNAVAILABLE` failure; evidence mandatory (throws when unpersisted); `SKIPPED` recorded honestly instead of fabricated success; `READY` only from `VERIFYING` | Unit handler suites; state-machine tests |
| T10 | **Keycloak misconfiguration drift** | external admin changes | Reconcile-before-create; fingerprint compare; drift ⇒ `RECONCILIATION_REQUIRED` or `QUARANTINED` (never blind recreate/delete) | DB reconciliation test; reconcile logic unit coverage |

## Attack surface inventory

| Surface | Exposure | Trust assumption |
|---------|----------|------------------|
| HTTP API (`edge/keycloak/*`) | Authenticated Edge operators | JWT validation + permission codes enforced by guards |
| P7.4 workflow workers | Internal | Fencing tokens issued by engine; workers untrusted for stale work |
| Keycloak Admin API (outbound) | Registered server only | TLS (except loopback lab), service-account least scope |
| OIDC discovery / JWKS (outbound) | Registered server only | Public endpoints, still origin-confined |
| Vault (`SecretsProviderPort`) | Internal | Encrypted at rest; material returned only by `sec_` ref |
| PostgreSQL control plane | Internal | `credential_ref` columns only; schema-guard test |
| Frontend console | Authenticated operators | RBAC gates; never receives secret values (masked refs) |
| Profile options (`profileOptions`) | Declarative, P7.2 contract | Not free-form user input; redirect/origin policy applied |

**Trust boundaries:** (1) Edge ⇄ Keycloak server (SSRF + TLS + token), (2) Edge ⇄ vault (ref indirection), (3) Edge ⇄ P7.1 authorization (fail-closed revalidation), (4) API ⇄ workflow engine (mutations only via steps).

## Verification summary (executed 2026-11-12)

| Suite | What it proves | Result |
|-------|----------------|--------|
| Security (12 P7.7 tests inside 58/58) | SSRF, masking, fencing, P7.1 fail-closed, redirect policy | **PASS** |
| Live Keycloak (8/8, KC 26.0.7) | Real admin API, origin confinement, secret-once, redaction, health leak-free | **PASS** |
| DB integration (7/7) | Schema guards, opaque refs, uniqueness, optimistic locking, evidence/history/reconciliation | **PASS** |
| Unit (within 855/855) | State machine, plan validation, handler fencing/compensation | **PASS** |
| Frontend (6 within 120/120) | RBAC gates, credential masking, explicit destructive actions | **PASS** |

## Keycloak 26 hardening notes

- Exact KC 26 field names prevent rejected/ignored realm settings (defect #1) — a rejected setting would otherwise leave session defaults unhardened.
- Token invalidation after realm create prevents 403-driven workarounds (defect #3) — no one needs to widen service-account scope "to make it work".
- Provisioned realms: self-registration off, `userManagedAccessAllowed=false`, `revokeRefreshToken=true`, `refreshTokenMaxReuse=0`, `sslRequired=external` default.
- Plain HTTP only for loopback lab servers, never for `PRODUCTION` environment (registration check).

## Residual risks

| Risk | Severity | Mitigation / next step |
|------|----------|------------------------|
| Evidence/audit redaction is convention + tests, not a schema-level scanner | Low | Future: JSONB validator on `evidence` writes |
| Model B org creation path untested live | Medium | Add `createOrganization` live test (feature already enabled in container) |
| Loopback HTTP allowed under attestation — misconfiguration could expose local admin traffic | Low | Environment check blocks PRODUCTION; operator attestation required |
| Frontend inherited TS debt (85 pre-existing errors outside P7.7) | Low (quality) | Separate cleanup; P7.7 files are clean |
| Push to GitHub blocked (HTTP 403) — changes uncommitted/unpushed | Process | Owner permission fix on `ntrus-saas-plateform/*` (known since P7.6) |

## Out of scope for this review

- **Business IAM** (tenant end-users, memberships, business roles/permissions, invitations) — owned by business backends, not present in Edge.
- **P7.8+ activation/readiness** — deployment configs, product provisioning and tenant activation are not implemented.
- Keycloak server hardening itself (OS/image-level) — only the API-level configuration Edge writes is reviewed here.
