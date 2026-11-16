# 10 — Public API & security (remediation)

## Routes publiques (`@Public`)

| Méthode | Path | Contrôles |
|---------|------|-----------|
| GET | `…/public/products`, `…/products/:slug`, `…/plans` | Rate-limiter + throttle |
| GET | `…/public/forms/:publicSlug` | Idem |
| GET | `…/public/challenge` | Challenge math HMAC |
| POST | `…/public/leads` | Challenge + honeypot/timing + consents + **Throttle 20/min** + Redis limiter |
| POST | `…/public/analytics/events` | Strip PII + **Throttle 120/min** + limiter |

Console : Bearer + `@RequireEdgePermissions` (`platform:acquisition:*`) — matrix `acquisition.controller.auth.spec.ts`.

## Remédiations sécurité

1. **P0 Consent** — `validateSubmittedConsents` (marketing public + leads P10 si `requiredConsents`)
2. **`AcquisitionPublicRateLimiter`** — Redis `INCR`+`EXPIRE` clé `acq:public:${route}:${ip}` ; fallback Map process-local + `X-RateLimit-Mode: local`
3. **Trust proxy** — `ACQUISITION_TRUST_PROXY=true` (Nest) / `EDGE_TRUST_PROXY=1` (BFF) uniquement derrière edge de confiance
4. **BFF FE** — `app/api/acquisition-public` Map advisory POST 20/min ; SoT = Nest + Redis limiter
5. Challenge math + honeypot + timing (hCaptcha externe optionnel / non branché)
6. `assertNoPaymentCredentials` ; publish immuable ; SoD ; audit append-only

## Note juridictionnelle

Validation technique du consentement ≠ conformité légale. Revue juridique **par juridiction** requise.

## Différé

Encryption field-level, GDPR erase workflow, DLP uploads, WAF/bot score externe, Testcontainers concurrency suite.
