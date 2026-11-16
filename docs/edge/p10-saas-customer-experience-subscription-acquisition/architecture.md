# P10 — Architecture

## Positionnement

P10 est le **control plane expérience client & acquisition d’abonnement** d’Okapi Edge. Il orchestre présentation, capture de leads, dossiers de candidature, qualification, devis et checkout **jusqu’au handoff** ; il **ne** devient **pas** :

- le catalogue produits (P1),
- l’autorité commerciale / pricing (P2),
- le CRM comptes (P4),
- l’autorité subscription / entitlement (P5),
- le moteur billing / paiement (P6),
- le IAM tenant / provisioning (P7/P8),
- le moteur de formulaires marketing (campagnes).

## Style

Modular monolith NestJS hexagonale, cohérent avec P7–P9.

```
presentation (controllers/DTOs)          ← DELIVERED (console + public)
    ↓
application (use-cases)                  ← DELIVERED (acquisition.use-cases.ts)
    ↓
domain (types, policies, ports, form-*)  ← DELIVERED
    ↑
infrastructure (PG repository + providers) ← DELIVERED
```

**Frontend** `/edge/acquisition`, `/acquire` : **NOT STARTED** (voir `frontend-architecture.md`).

## Agrégats initiaux (P10.0+)

1. **ProductPresentation / ContentVersion** — contenu CX versionné, refs P1
2. **SegmentPresentation / PlanPresentation** — display-only ; `price_display_mode`
3. **Prospect / AcquisitionLead** — funnel capture ; events append-only
4. **FormSchema / FormVersion / FormPublication** — published versions immutable
5. **Application** (+ answers, documents, reviews, qualification)
6. **QuoteRequest / QuoteReference** — refs commerciales ; pas de pricing inventé
7. **CheckoutSession** (+ events) — orchestration ; pas de credentials paiement
8. **SubscriptionHandoff** — vers P5
9. **JourneyDefinition / Instance / Events** — parcours acquisition
10. **Communications / Analytics / Attribution / Audit / Idempotency**

## Intégrations (ports)

| Port | Direction | Source of truth |
|------|-----------|-----------------|
| P1 product refs | inbound read | `edge_products` |
| P2 plan / commercial refs | inbound read | `edge_commercial_plans` |
| P4 commercial account | soft link | `edge_sales_commercial_accounts` |
| P5 subscription handoff | outbound | Orchestration record + outbox (`edge.p10.subscription.handoff.*`) — **not** P5 SoT |
| P6 checkout / payment | outbound refs | `billing_session_ref` / `p6Status` only — never store credentials |
| Marketing | optional signal | Leads marketing ≠ P10 applications |
| Notification | outbound | Identity / messaging adapters |

## Pricing & display

- `price_display_mode ∈ { AUTHORITATIVE, INDICATIVE, QUOTE_REQUIRED, ENTERPRISE_CUSTOM }`
- P10 stocke des **références d’affichage** (`display_ref`, metadata) — jamais un montant inventé.
- `QUOTE_REQUIRED` / `ENTERPRISE_CUSTOM` bloquent checkout self-serve jusqu’à quote ref valide.

## Événements

- Outbox tenant constant : `edge-p10-acquisition` (`EDGE_P10_OUTBOX_TENANT`)
- Types : `edge.p10.*`
- Audit durable obligatoire sur publish, review, approve, checkout, handoff

## Wiring status

- Nest providers / controllers / PG : **wired**
- FE console & public acquire : **not started**
- Verdict doc package : `P10 PARTIALLY IMPLEMENTED` (voir `acceptance-report.md`)
