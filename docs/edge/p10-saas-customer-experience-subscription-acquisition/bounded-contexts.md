# P10 — Bounded contexts

Contexts alignés au mandate acquisition CX, nommés selon conventions Edge (`acquisition/*`).

| Context | Ownership | Dépendances |
|---------|-----------|-------------|
| `product-presentation` | Présentations produit + content versions | P1 products (read) |
| `segment-presentation` | Segments / personas CX | product-presentation |
| `plan-presentation` | Affichage plans + `price_display_mode` | P2 commercial plans (read) |
| `prospect-management` | Prospects acquisition | P4 account soft-link |
| `lead-capture` | Leads + lead events | prospects, forms, marketing signals (opt.) |
| `acquisition-forms` | Form schemas / versions / publications | — |
| `document-requirements` | Exigences documentaires par parcours | forms, applications |
| `application-management` | Dossiers + answers + events | forms, prospects, documents |
| `document-review` | Refs documents + reviews | applications |
| `qualification` | Qualification records | applications, reviews |
| `review-assignment` | Affectation reviewers / SoD | qualification, applications |
| `quote-orchestration` | Quote requests + refs | P2 commercial ; pas de invente prix |
| `checkout-orchestration` | Sessions + events checkout | P6 billing adapter |
| `subscription-handoff` | Handoff vers P5 | checkout, qualification |
| `acquisition-journey` | Definitions / instances / events | all funnel stages |
| `acquisition-communications` | Comms outbound tracked | journey, applications |
| `acquisition-analytics` | Events analytics + attribution | funnel |
| `acquisition-governance` | Audit + idempotency + policies | all |

**Règle :** pas de monolithe logique `acquisition.ts` unique côté application — dossiers séparés, providers groupés (quand câblés en P10.1).

**Frontière marketing :** `marketing/forms` capture campagne ; `acquisition-forms` capture candidature / KYC / onboarding commercial. Croisement possible via attribution / lead id soft-ref uniquement.
