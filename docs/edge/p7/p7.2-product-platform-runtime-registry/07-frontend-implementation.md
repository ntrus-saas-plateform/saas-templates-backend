# P7.2 — Implémentation frontend

**App :** `saas-template-frontend`  
**Route principale :** `/edge/provisioning/registry`  
**Détail :** `/edge/provisioning/registry/[section]/[id]`

## Fichiers

| Fichier | Rôle |
|---------|------|
| `app/(edge-console)/edge/provisioning/registry/page.tsx` | Page multi-onglets Registry Management |
| `app/(edge-console)/edge/provisioning/registry/[section]/[id]/page.tsx` | Détail + transitions / patch |
| `components/edge/registry/shared.tsx` | Table shell, badges, filtres, pagination |
| `lib/edge/registry.ts` | Helpers unwrap, options status, redact secure ref |
| `types/edge-registry.ts` | Types TS alignés domaine |
| `lib/api/edge.ts` | Clients `listRegistry*`, `createRegistry*`, `evaluateRegistryCompatibility`, … |

## Onglets (RBAC)

| Tab | Permission(s) | Capacités UI |
|-----|---------------|--------------|
| Products | `platform:product_registry:read` | Liste + create (manage) |
| Versions | product_registry:read | Scoped à un product registry ; create version |
| Platforms | `platform:product_platforms:read` | Liste + create ; `secureConfigRef` redacté en table |
| Environments | `platform:runtime_environments:read` | Create lié à une plateforme |
| Profiles | `platform:deployment_profiles:read` | Seed only — pas de create ; détail pour update/transition |
| Contracts | `platform:product_control_contracts:read` | Create produit catalogue × plateforme |
| Compatibility | evaluate (+ read produit) | Formulaire 6 IDs + historique évaluations |
| History | `platform:registry_history:read` | Timeline unifiée |

Onglets non autorisés masqués ; page entière → `EdgeForbiddenState` si aucune permission read pertinente.

## Patterns UX

- React Query keys préfixées `["edge","registry",…]`
- `EdgePermissionGate` autour des sections
- États : Loading / Error / Empty / Forbidden (composants Edge réutilisés)
- Pagination `LIMIT=20`
- Create forms conditionnés par `*:manage`
- Liens détail vers `/edge/provisioning/registry/{products|versions|platforms|environments|profiles|contracts|compatibility}/:id`
- Page détail : affichage champs + transition lifecycle (certify/manage selon section) + optimistic version quand applicable
- `redactSecureConfigRef` — jamais afficher un secret ; handle opaque seulement

## Intégration catalogue P1

- Create produit registre / contrat : select `edgeApi.listProducts` (catalogue commercial)
- Versions / compat : select sur entrées `listRegistryProducts`

## Hors scope UI

Pas d’écrans de provisioning tenant/DB/Keycloak/runtime dans ce package — registre technique uniquement.
