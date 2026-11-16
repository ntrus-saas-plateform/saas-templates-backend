# 14 — Frontend implementation (remediation)

**Repo :** `saas-template-frontend` · branche `feature/console` · HEAD livraison P10 `e5a8e32` (baseline audit historique `d7dcb2e`).

## Surfaces

| Path | Rôle |
|------|------|
| `/edge/acquisition` | Console ops (overview, products, plans, forms, prospects, applications, documents, quotes, checkout, journeys, analytics) |
| `/acquire` | Discovery publique |
| `/acquire/[slug]` | Produit + plans |
| `/acquire/[slug]/apply` | Formulaire dynamique (pas de champs carte ; honeypot ; challenge UI) |
| `/acquire/portal` | Shell portail |
| `/acquire/checkout/[sessionId]` | Revue checkout sans carte |

## Fichiers clés

- `types/edge-acquisition.ts`
- `lib/api/edge.ts` — section P10
- `components/edge/acquisition/edge-acquisition-module.tsx`
- `app/(edge-console)/edge/acquisition/page.tsx`
- `app/(acquisition-public)/acquire/**`
- `app/api/acquisition-public/[...path]/route.ts` — proxy public ; rate-limit **advisory** ; `EDGE_TRUST_PROXY=1`
- E2E : `e2e/edge-acquisition-smoke.spec.ts`, `e2e/edge-acquisition-scenarios.spec.ts`

## Tests FE

Module Vitest acquisition : **14** passed (session remédiation).  
Playwright live : **18/18** (backend Edge peut être down — shells/contrats proxy).

## Limites

Builder JSON seulement ; portail non authentifié ; happy-path lead/checkout live E2E 40 **pending**.
