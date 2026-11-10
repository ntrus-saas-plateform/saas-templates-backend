# P7.5 — Revue sécurité

**Date :** 2026-11-10  
**Périmètre :** Product Control Integration (pas de P7.6+ provisioning)

| Contrôle | Statut |
|----------|--------|
| Auth Edge + permissions granulaires | OK |
| `credential_ref` opaque (pas de secrets PG) | OK |
| Signature HMAC + skew / expiry | OK — tests unitaires |
| TLS + SSRF allowlist + redirect block | OK — tests unitaires |
| Product ID mismatch / security non-retryable | OK |
| ValidationPipe whitelist / forbidNonWhitelisted | OK — DTO specs |
| Atomicité register/callback + rollback audit/outbox | OK — integration Testcontainers |
| Quarantine bloque dispatch (`FOR UPDATE`) | OK |
| Mutative provision handlers | `OPERATION_NOT_IMPLEMENTED` |

Pas de stockage de tokens/certificats privés dans les réponses API.
