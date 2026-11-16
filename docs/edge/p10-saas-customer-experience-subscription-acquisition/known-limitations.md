# P10 — Known limitations (post-audit)

1. **Object storage / malware scan** — FS (`ACQUISITION_PRIVATE_STORAGE_ROOT`, défaut `.data/acquisition-private`) et S3 (`ACQUISITION_S3_BUCKET` + AWS region/credentials) disponibles via factory ; `ACQUISITION_STORAGE_MODE=pending` conserve l’adapter metadata-only. Scan ClamAV si `CLAMAV_HOST`+`CLAMAV_PORT` ; sinon `ACQUISITION_SCAN_MODE=mock_*` (tests) ou `SCAN_UNAVAILABLE`. Jamais traité comme CLEAN sans scan réussi. Upload binaire out-of-band : register valide locator/métadonnées (FS marker / S3 Put metadata).
2. **CAPTCHA** — challenge math signé HMAC intégré (`GET …/public/challenge` + `challengeId`/`challengeToken`/`challengeAnswer` sur lead). Honeypot + timing conservés. Provider externe (hCaptcha/reCAPTCHA) toujours optionnel / non branché.
3. **Public rate limit** — `AcquisitionPublicRateLimiter` distribué via Redis ; si Redis down → Map **process-local** (pas multi-instance) + `X-RateLimit-Mode: local`. Activer `ACQUISITION_TRUST_PROXY=true` / `EDGE_TRUST_PROXY=1` uniquement derrière un proxy de confiance. Le BFF Next reste advisory (POST 20/min).
4. **Browser E2E 40 live** — suite domain/application 40/40 Pass ; smoke Playwright seulement.
5. **Form builder** — JSON + schéma apply typé ; pas de DSL visuelle drag-and-drop.
6. **Journey timers / GDPR automation** — advance manuel ; erase/retention non automatisés. Consent lead public validé si `metadata.requiredConsents` ; pas de workflow erase automatisé.
7. **RBAC** — SUPER_ADMIN + OPERATOR (119) ; rôles métier fins à étendre.
8. **Migration apply** — 117 + 119 à appliquer sur env cibles (`pnpm migrate:control`).
9. **Working tree** — changements P10 non commités jusqu’à demande explicite.
