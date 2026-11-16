# P10 — Security & privacy

## Contrôles implémentés

| Contrôle | Preuve |
|----------|--------|
| Auth Edge + permissions | Controllers `@UseGuards` + `@RequireEdgePermissions` |
| Public endpoints | `@Public()` + Nest `@Throttle` (leads 20/min, analytics 120/min) |
| Distributed public abuse limiter | `AcquisitionPublicRateLimiter` (Redis INCR+EXPIRE via CacheService; fallback process-local Map + `X-RateLimit-Mode: local`) |
| Trust proxy for public IP | `ACQUISITION_TRUST_PROXY=true` required before using `X-Forwarded-For`; sinon `req.ip` / `socket.remoteAddress` |
| BFF proxy (FE) | Advisory Map only — `EDGE_TRUST_PROXY=1` pour XFF leftmost; SoT = Nest Throttle + `AcquisitionPublicRateLimiter` |
| Public lead consents | Si `publication.metadata.requiredConsents` → `validateSubmittedConsents` (même règles que marketing) |
| Application Save/Submit | `assertFormAnswersValid` sur schéma bound (champs required / types) |
| No payment credentials | `assertNoPaymentCredentials` + pas de colonnes carte |
| Immutable published versions | Policy form/content |
| SoD self-approve | `assertSeparationOfDuties` |
| Document outbox sans storage URL | RegisterDocumentUpload payload stripped |
| Analytics PII strip | Keys sensibles retirées des properties |
| Audit append-only | `edge_p10_audit_events` sur mutations clés |
| Idempotency checkout | `edge_p10_idempotency_keys` |

## Rate limiting (public)

1. **Nest Throttler** — garde globale + `@Throttle` par route.
2. **`AcquisitionPublicRateLimiter`** — clé `acq:public:${route}:${clientIp}` avant le use case (POST leads/analytics et GET publics).
3. **Redis** — pattern `INCR` + `EXPIRE` sur `rl:<key>`. Fail-closed métier : le plafond est toujours appliqué ; si Redis est indisponible → Map locale + warning + header `X-RateLimit-Mode: local`.
4. **Frontend BFF** (`app/api/acquisition-public/[...path]`) — limite advisory (POST 20/min) ; ne pas s’y fier seul en production.

## Trust proxy

| Env | Effet |
|-----|--------|
| `ACQUISITION_TRUST_PROXY=true` (Nest) | Autorise le leftmost `X-Forwarded-For` pour la clé rate-limit |
| `EDGE_TRUST_PROXY=1` (Next BFF) | Idem côté proxy ; sinon `unknown-edge` + hash User-Agent (ou `cf-connecting-ip` si présent) |

Ne jamais activer trust proxy sans edge TLS / reverse-proxy de confiance (sinon spoof IP → bypass rate limit).

## Données personnelles

- Emails normalisés sur prospects/leads
- Answers JSONB peuvent contenir PII métier — rétention / purge **pas** automatisée dans P10
- Documents : refs storage externes seulement
- Preuves de consentement lead public stockées dans `metadata.consentEvidence` quand `requiredConsents` est déclaré

## Non livré

- Encryption field-level / tokenization
- Right-to-erasure workflow GDPR automatisé
- DLP scanning uploads
- WAF / bot score au-delà du challenge math + throttle + limiter Redis

## Statut

**Baseline security controls DONE ; privacy ops tooling pending.**
