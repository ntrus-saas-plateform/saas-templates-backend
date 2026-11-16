# P10 — Account / Prospect / Customer model

## Principes

1. **P4** reste la SoT des **commercial accounts** (`edge_sales_commercial_accounts`).
2. **P10 prospect** est une entité d’**acquisition CX** (funnel), pas un compte CRM de remplacement.
3. **Customer** au sens abonnement = résultat d’un **subscription handoff** réussi vers **P5** (+ billing P6). P10 ne crée pas d’entitlement.
4. Liens soft UUID autorisés quand le compte P4 n’existe pas encore.

## Entités

```
Anonymous visitor
        │ analytics / attribution
        ▼
AcquisitionLead ──events──▶ (capture, score, nurture)
        │
        ▼
Prospect (P10) ──── optional ────▶ CommercialAccount (P4)
        │
        ▼
Application (+ answers, documents, reviews, qualification)
        │
        ├──▶ QuoteRequest / QuoteReference (si QUOTE_REQUIRED / ENTERPRISE)
        │
        ▼
CheckoutSession ──▶ (P6 payment orchestration; no credentials in P10)
        │
        ▼
SubscriptionHandoff ──▶ P5 subscription
        │
        ▼
Customer (commercial + subscription) — owned by P4/P5, not P10
```

## Prospect (P10)

| Champ clé | Rôle |
|-----------|------|
| `status` | Lifecycle acquisition (voir policy) |
| `email` / identity refs | Contact funnel |
| `commercial_account_id` | Soft FK → P4 si compte connu |
| `product_id` / `plan_id` | Intent refs → P1/P2 |
| `metadata` | Extensibilité ; pas de secrets |

## Lead vs Prospect

- **Lead** : signal capturé (formulaire, campagne, inbound) — append-only events.
- **Prospect** : sujet d’acquisition qualifiable ; un lead peut être promu / lié à un prospect.
- Marketing lead id peut être stocké en soft-ref dans metadata / attribution — **pas** de merge schema marketing.

## Application → Customer

1. Application soumise sur form version **publiée** (immutable).
2. Documents reviewés ; qualification `APPROVED` (ou parcours self-serve exempt).
3. Quote ref si mode prix l’exige.
4. Checkout session créée (idempotente) ; succès confirmé par événements P6 / adapter.
5. `SubscriptionHandoff` émis ; statut terminal `COMPLETED` seulement avec preuve externe / ack P5 — jamais inventé.

## Interdits

- Dupliquer `edge_sales_commercial_accounts` dans P10.
- Créer un « tenant customer » IAM depuis P10.
- Stocker PAN / secrets paiement.
- Marquer un prospect `CONVERTED` sans handoff / preuve subscription.
