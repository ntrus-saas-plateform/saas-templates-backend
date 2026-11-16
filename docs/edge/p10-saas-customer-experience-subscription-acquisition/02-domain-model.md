# 02 — Domain model (remediation)

## Agrégats `domain/acquisition`

| Agrégat | Tables | Notes |
|---------|--------|-------|
| ProductPresentation / ContentVersion | `edge_p10_product_*` | Refs P1 ; publish immuable |
| Segment / PlanPresentation | `edge_p10_*_presentations` | `price_display_mode` |
| Prospect / AcquisitionLead (+ events) | `edge_p10_prospects`, `*_leads` | Email normalisé ; consent evidence metadata |
| FormSchema / FormVersion / FormPublication | `edge_p10_form_*` | Published = immutable |
| Application (+ answers, events) | `edge_p10_applications*` | Bound `formVersionId` |
| DocumentRequirement / Reference / Review | `edge_p10_document_*` | Locator privé ; pas d’URL http |
| Qualification / ReviewAssignment | `edge_p10_qualification_*` | SoD policy |
| QuoteRequest / QuoteReference | `edge_p10_quote_*` | Pas de pricing inventé |
| CheckoutSession (+ events) | `edge_p10_checkout_*` | Idempotency ; refs P6 |
| SubscriptionHandoff | `edge_p10_subscription_handoffs` | Orchestration vers P5 |
| Journey Definition / Instance / Events | `edge_p10_journey_*` | Advance manuel |
| Communications / Analytics / Attribution / Audit / Idempotency | `edge_p10_*` | Queue / strip PII |

## Policies clés

- `acquisition-policy.ts` — transitions, SoD, `assertNoPaymentCredentials`, price modes
- `form-condition.ts` / `form-validation.ts` — conditions + answers fail-closed
- `acquisition-public-challenge.ts` — challenge math HMAC
- **`marketing-consent.ts`** — `validateSubmittedConsents` (P0 remédiation ; partagé marketing + leads P10)

## Concurrency

Colonnes `version INTEGER` optimistic sur agrégats principaux.

## Statut

Modèle **implémenté** en types + PG mig 117. Pas de 121 au moment de la remédiation (120 = consent marketing only).
