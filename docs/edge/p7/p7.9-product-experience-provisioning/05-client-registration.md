# P7.9 — Client Registration

## Scope

Registers **technical OIDC clients** for a tenant experience assignment. Edge does **not** create or manage business IAM users, roles, memberships, or organizations in this package.

## Data model

`ExperienceClientRegistration` (`edge_p7_experience_client_registrations`):

| Field | Notes |
|-------|-------|
| `clientId` | Unique per tenant |
| `clientKind` | `PUBLIC` \| `CONFIDENTIAL` \| `SERVICE_ACCOUNT` |
| `redirectUris` / `postLogoutRedirectUris` / `webOrigins` | Validated by access policy |
| `audiences` / `scopes` | Opaque string lists |
| `credentialRef` | Vault ref only (`sec_*` / `vault:`) — never plaintext |
| `keycloakClientRef` | Local apply writes `local://<tenantId>/<clientId>`; topology id optional |
| `registrationStatus` | `PENDING` → `ACTIVE` \| `FAILED`; deactivate → `REVOKED` |

## When registration runs

Handler `experience.register_clients` inside `p79.experience.provision`:

1. Gate: P7.1 revalidation + optional P7.4 lease fencing.
2. Reject plaintext secret fields on each client entry.
3. Validate redirects / origins; bind redirects to verified domains when any exist.
4. Upsert registration to `ACTIVE` and append a `REGISTER_CLIENT` deployment run + evidence (redacted).

## Deactivation

`experience.deactivate` sets all non-revoked client registrations on the assignment to `REVOKED`.

## Hard rules

- No plaintext secrets in manifests, registration rows, or evidence.
- Credential material is referenced only via `credential_ref`.
- Client registry is technical; it is not a substitute for Keycloak business-organization provisioning (P7.7).
