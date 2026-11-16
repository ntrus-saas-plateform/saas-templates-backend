# P10 — Plan presentation

## Objectif

Affichage commercial des plans P2 avec `price_display_mode` — **jamais** inventer un montant.

## Modèle

`edge_p10_plan_presentations` :

| Champ | Rôle |
|-------|------|
| `commercial_plan_id` | FK → `edge_commercial_plans` (P2) |
| `price_display_mode` | `AUTHORITATIVE` \| `INDICATIVE` \| `QUOTE_REQUIRED` \| `ENTERPRISE_CUSTOM` |
| `price_display_ref` | Réf d’affichage externe (obligatoire si AUTHORITATIVE) |
| `currency_hint` | Indice display seulement |
| `features_display` | JSON display-only |

## Policies (code)

- `assertPriceDisplayRef` — AUTHORITATIVE exige `price_display_ref` ≥ 2 chars.
- `assertCheckoutAllowedForPriceMode` — QUOTE_REQUIRED / ENTERPRISE_CUSTOM bloquent checkout sans `quoteReferenceId`.
- `RevalidatePlanBeforeCheckoutUseCase` — lit le plan P2 ; si unpublished ou version prix changée → confirmation obligatoire.

## API

| Route | Notes |
|-------|-------|
| `GET/POST edge/acquisition/plans` | Console |
| `GET edge/acquisition/public/plans` | Publié seulement |
| `POST edge/acquisition/checkout/revalidate-plan` | Revalidation P2 |

## Statut

**BE core DONE.** FE pricing cards /acquire **pending**. Pas de calcul de prix dans P10.
