# P10 — Remediation package · Implementation summary

**Date :** 2026-11-16  
**Branche :** `feature/console`  
**Package :** remédiation post-audit (docs `00`–`19`) — les documents thématiques préexistants sont conservés.

## SHAs

| | Baseline audit (mentionné) | HEAD courant (travail P10) |
|--|----------------------------|----------------------------|
| Backend `saas-templates-backend` | `4fadf08` (P7.7 Keycloak) | `0c0df38` (+ working tree remédiation consent / rate-limit) |
| Frontend `saas-template-frontend` | `d7dcb2e` (P7.7 console) | `e5a8e32` (acquisition console + `/acquire`) |

Le travail P10 s’empile **au-dessus** de ces baselines historiques sur `feature/console` (commits P8/P9 intermédiaires inclus).

## Ce qui est livré (post-remédiation)

| Domaine | État |
|---------|------|
| Module acquisition hexagonal (domain / application / infra / presentation) | **DONE** |
| Migrations `117`, `119` (+ evidence apply) ; `120` consent `NOT_PROVIDED` | **DONE** (120 untracked jusqu’à commit) |
| P0 consent marketing + leads publics → `validateSubmittedConsents` | **FIXED** |
| `AcquisitionPublicRateLimiter` Redis + fallback local ; BFF FE advisory | **DONE** |
| Forms, applications, docs FS/S3 + ClamAV/mock, challenge math | **DONE** |
| Checkout orchestration + `InitiateAcquisitionPayment` (P6 refs only) | **DONE** |
| Handoff P5 record + outbox + `P10SubscriptionHandoffHandler` | **DONE** |
| Console `/edge/acquisition` + public `/acquire` + portal shell | **DONE (MVP)** |
| Domain scenarios **40/40** ; Playwright live **18** | **EVIDENCED** |

## Remédiations P0 / sécurité

1. **Consent** — `marketing-consent.ts` + `SubmitMarketingFormPublicUseCase` et capture lead P10 si `metadata.requiredConsents` ; états `GRANTED|DENIED|NOT_PROVIDED|WITHDRAWN` ; mig **120**.
2. **Abuse public** — Nest `@Throttle` + `AcquisitionPublicRateLimiter` (Redis INCR/EXPIRE) ; trust proxy opt-in ; FE proxy **advisory only**.
3. **Pas de credentials paiement** — `assertNoPaymentCredentials` + checkout sans colonnes carte.
4. **Storage** — FS / S3 privés ; scan fail-closed (`SCAN_UNAVAILABLE` ≠ CLEAN).

## Différé / incomplet (honnête)

- Suite **Testcontainers** concurrence / mig E3 : incomplete
- Env live Edge + ClamAV + S3 prod : non smoke en lab réel
- Push remote peut échouer (ahead local / auth) — non bloquant code
- **Pas de self-ACCEPT** enterprise production
- GDPR erase automation, WAF/bot score externe, form builder drag-and-drop

## Note juridictionnelle

> **Le consentement technique validé par `validateSubmittedConsents` n’équivaut pas à la conformité légale.** Une revue juridique par juridiction (RGPD/ePrivacy, CCPA, etc.) reste obligatoire avant mise en production marketing / acquisition.

## Verdict package

Voir [`19-p10-acceptance-report.md`](./19-p10-acceptance-report.md) → **READY FOR INDEPENDENT AUDIT**.
