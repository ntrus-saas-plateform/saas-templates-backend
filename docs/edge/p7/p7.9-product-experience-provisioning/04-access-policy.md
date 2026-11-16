# P7.9 — Access Policy

## Location

`domain/product-experience/experience-access.policy.ts`  
Consumed by assign validation and the live executor (`register_clients`, `bind_domains`, TLS gate).

## Redirect URIs

`validateRedirectUris`:

- Reject empty, wildcards (`*`), templates (`{…}`, `${…}`), `null`, whitespace / quote characters.
- Allow `https:` always; `http:` only for attested loopback hosts (`localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`) when `allowLoopbackHttp` is set.
- Reject non-http(s) schemes (`javascript:`, `data:`, …).

Failure code: `REDIRECT_URI_INVALID`.

Post-logout redirect URIs reuse the same validator.

## Web origins

`validateWebOrigins`:

- Reject `*`, `null`, wildcards.
- Origin must not include a non-root path.
- Same http/https rules as redirects (loopback http only when attested).

Failure code: `WEB_ORIGIN_INVALID`.

## Redirect ↔ domain binding

When verified hostnames exist for the assignment, `assertRedirectsBoundToDomains` requires each redirect host to be in that set (loopback hosts excepted). Failure: `CROSS_TENANT_ROUTING`.

## Hostnames & takeover protections

`validateHostname`:

- Lowercase FQDN, max 253 chars, no leading/trailing/double dots, no `*`.
- Format failures that look like takeover patterns use `DOMAIN_TAKEOVER_RISK`; generic format failures use `VALIDATION`.

Hostname uniqueness is enforced by `edge_p7_experience_domain_bindings.hostname` UNIQUE and use-case / executor conflict checks (`HOSTNAME_CONFLICT`).

## Ownership tokens

- `issueOwnershipToken()` → `own_<32 hex bytes>`.
- `ownershipChallengeRecord(hostname, token)` → SHA-256 of `hostname:token` for challenge material.
- Domain bind API creates bindings in `PENDING` ownership with a fresh token.
- Platform-attested `SUBDOMAIN` entries in the provision workflow may mark ownership `VERIFIED` and DNS `NOT_REQUIRED` when `platformAttested === true`. Custom domains remain ownership-gated; verify fails if custom domains lack ACTIVE tls/route/binding (`DOMAIN_OWNERSHIP_UNVERIFIED`).

## TLS / certificate refs

TLS provision writes opaque `certificate_ref` values such as `vault:experience-tls/<hostname>` and certificate rows with `noPem: true` metadata. No PEM or private key material is stored in the experience tables.

## Secrets

- Vault refs: `sec_[A-Za-z0-9_-]+` or `vault:…`.
- `credentialRef` on clients must be a vault ref when present.
- Manifest secret-like keys with non-vault string values are rejected at assign time.
