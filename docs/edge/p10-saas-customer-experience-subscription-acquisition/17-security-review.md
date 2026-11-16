# 17 — Security review (remediation)

## Findings traités (P0 / haute)

| ID | Finding | Remédiation | Statut |
|----|---------|-------------|--------|
| P0 | Consent marketing / public accepté sans validation `requiredConsents` | `validateSubmittedConsents` + preuves + mig **120** `NOT_PROVIDED` | **FIXED** |
| H | Rate-limit public process-local only | `AcquisitionPublicRateLimiter` Redis + fallback local documenté | **FIXED** |
| H | Trust proxy / spoof IP | Opt-in `ACQUISITION_TRUST_PROXY` / `EDGE_TRUST_PROXY` | **FIXED** |
| M | FE BFF présenté comme SoT abuse | Doc + code : advisory only | **FIXED** |
| M | Credentials paiement | `assertNoPaymentCredentials` + no card columns/UI | **OK** |
| M | Document URLs dans outbox | Strip locator ; storage privé | **OK** |
| M | Analytics PII | `stripSensitiveProperties` | **OK** |

## Contrôles en place

Auth Edge + RBAC `platform:acquisition:*` · Nest Throttle · Redis limiter · challenge HMAC · honeypot/timing · publish immuable · SoD · audit append-only · idempotency checkout · malware scan fail-closed.

## Résidus acceptés pour audit indépendant

- Redis down → mode `local` (pas multi-instance) — header exposé  
- Pas de WAF / hCaptcha branché  
- Pas d’encryption field-level / GDPR erase automatisé  
- Env ClamAV/S3 live non certifié dans ce package  
- Consent technique ≠ conformité légale (**revue juridique juridictionnelle requise**)

## Verdict sécurité package

**Baseline controls + P0 remédiés — prêt pour audit indépendant**, pas pour self-ACCEPT production enterprise.
