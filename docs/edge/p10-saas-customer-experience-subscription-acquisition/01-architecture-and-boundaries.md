# 01 — Architecture & boundaries (remediation)

## Style

Modular monolith NestJS hexagonal — aligné P7–P9 :

```
presentation/  acquisition.controller.ts + acquisition-public.controller.ts
application/   acquisition.use-cases.ts (+ scenarios / auth specs)
domain/        acquisition/* + marketing-consent (réutilisé)
infrastructure/acquisition/* (PG, storage, rate-limiter, handoff handler)
```

Frontend (même app Next) : `/edge/acquisition` (console) · `/acquire/**` (public) · BFF `app/api/acquisition-public`.

## Boundaries non négociables

| Phase | SoT | P10 fait |
|-------|-----|----------|
| P1 | Produits | Présentations / content versions (refs) |
| P2 | Plans / commercial | `plan_presentations` + `price_display_mode` — jamais inventer un prix |
| P4 | Comptes CRM | Soft link `commercial_account_id` |
| P5 | Subscription / entitlement | Handoff record + outbox + consumer → `CreateSubscriptionUseCase` |
| P6 | Billing / paiement | Refs intent + `InitiateAcquisitionPayment` ; jamais carte |
| P7/P8 | IAM / tenant | **Hors P10** — `provisioningComplete` jamais inventé |
| Marketing | Forms campagnes | ≠ form engine acquisition ; consent partagé via `validateSubmittedConsents` |
| P9 | Operations | Indépendant |

## Outbox

Tenant constant `edge-p10-acquisition` ; types `edge.p10.*` ; audit fail-closed sur mutations sensibles.

## Statut remédiation

Wiring Nest + PG + FE MVP **en place**. Architecture docs thématiques préexistants (`architecture.md`, `bounded-contexts.md`) restent la référence narrative ; ce fichier fige l’état **post-remédiation**.
