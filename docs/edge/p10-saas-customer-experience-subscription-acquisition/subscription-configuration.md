# P10 — Subscription configuration

## Clarification

P10 **configure l’intention** d’abonnement (plan, compte commercial, quote, checkout) mais **n’est pas** la SoT subscription/entitlement (P5).

## Données d’intent (P10)

| Source | Champs |
|--------|--------|
| Prospect / Application | `productId`, `commercialPlanId`, `planPresentationId` |
| Quote reference | `externalQuoteRef` |
| Checkout session | `commercialPlanId`, `quoteReferenceId`, `billingSessionRef` |
| Handoff | `commercialAccountId`, `commercialPlanId`, `subscriptionRef` (rempli à complete) |

## Non stocké

- Entitlements, seats runtime, feature flags produit
- Credentials paiement / PAN
- Tenant Keycloak / realm config (P7)

## Handoff

`RequestSubscriptionHandoffUseCase` crée `edge_p10_subscription_handoffs` status `REQUESTED` + outbox `edge.p10.subscription.handoff.requested`.  
Complétion exige `subscriptionId` P5 + `externalEvidenceRef` — jamais inventés.

## Statut

**Intent + handoff orchestration DONE.** Wiring Nest optionnel vers `CreateSubscriptionUseCase` P5 **non imposé** dans le repository acquisition (commentaire explicite dans le use-case).
