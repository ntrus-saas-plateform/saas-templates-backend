# P7.5 — Security & Authentication

| Control | Implementation |
|---------|----------------|
| Opaque credentials | `CredentialProviderPort` / `FakeCredentialProvider` / `EnvCredentialProvider` — DB stores `credential_ref` only |
| Signatures | `SignatureService` (HMAC-SHA256 + skew window) |
| TLS | HTTPS required on `base_url` (unless test insecure flag) |
| SSRF | Allowlist = hostname of endpoint `base_url` only; redirects to other hosts blocked |
| Timeouts / size / content-type | `HttpProductControlClient` defaults 10s / 1 MiB / `application/json` |
| Security errors | Authn/authz/TLS/signature/expiry → **not retryable** |

RBAC permissions: `platform:product_control:{read,manage,validate,handshake,discover,health,reconcile,quarantine,credentials:manage,history:read}`.
