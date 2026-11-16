# 03 — Product & acquisition contracts (remediation)

## Présentation produit / plan

- Console : CRUD présentations + content versions + publish
- Public : `GET …/public/products`, `…/products/:slug`, `…/plans` filtrés `CommercialAvailability` / `PUBLISHED`
- `price_display_mode ∈ { AUTHORITATIVE, INDICATIVE, QUOTE_REQUIRED, ENTERPRISE_CUSTOM }`
- `QUOTE_REQUIRED` / `ENTERPRISE_CUSTOM` bloquent self-serve checkout jusqu’à quote ref valide
- `RevalidatePlanBeforeCheckoutUseCase` — confirmation si termes commerciaux changés

## Prospects & leads

| Flux | Contrat |
|------|---------|
| Create / transition prospect | Console Bearer + permissions |
| Capture lead public | `POST …/public/leads` + challenge + honeypot/timing + throttle + rate-limiter |
| Promote lead → prospect | Console |
| Consents | Si `publication.metadata.requiredConsents` → `validateSubmittedConsents` ; preuve dans `metadata.consentEvidence` |

## Interdits

- Inventer produit / prix / disponibilité hors P1/P2
- Confondre form marketing campagne avec form acquisition P10
- Marquer prospect `CONVERTED` sans evidence handoff

## Statut

Contrats BE + surfaces FE discovery/apply **MVP DONE**.
