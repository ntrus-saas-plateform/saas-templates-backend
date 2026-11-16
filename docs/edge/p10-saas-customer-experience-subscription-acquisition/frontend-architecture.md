# P10 — Frontend architecture

## Surfaces livrées (décision 2A — même app Next)

| Path | Rôle |
|------|------|
| `/edge/acquisition` | Console ops CX — module onglets (overview, products, plans, forms, prospects, applications, documents, quotes, checkout, journeys, analytics) |
| `/acquire` | Discovery publique |
| `/acquire/[slug]` | Page produit + plans |
| `/acquire/[slug]/apply` | Formulaire dynamique (schema publié) |
| `/acquire/portal` | Shell portail client |
| `/acquire/checkout/[sessionId]` | Revue checkout (GET public status, sans carte) |

## Fichiers clés

- `types/edge-acquisition.ts`
- `lib/api/edge.ts` — section `// --- P10 Acquisition ---`
- `components/edge/acquisition/edge-acquisition-module.tsx`
- `app/(edge-console)/edge/acquisition/page.tsx`
- `app/(acquisition-public)/acquire/**`
- `app/api/acquisition-public/[...path]/route.ts` — proxy public sans session Edge
- Nav : `components/edge/edge-shell.tsx` → **Acquisition** (`platform:acquisition:read|manage`)
- E2E smoke : `e2e/edge-acquisition-smoke.spec.ts`

## Patterns

Aligné P8/P9 : React Query, `EdgePermissionGate`, états Edge partagés, `edgeApi`, pas de métriques inventées.

## Limites

- Builder de formulaire = éditeur JSON contraint (pas de JS exécutable).
- Scan malware / stockage objet privé = adapter `PendingAcquisitionDocumentStorageAdapter` (`SCAN_UNAVAILABLE`).
- Snapshot portail complet nécessite auth plateforme.
