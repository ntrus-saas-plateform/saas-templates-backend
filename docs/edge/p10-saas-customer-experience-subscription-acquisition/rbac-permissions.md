# P10 — RBAC & permissions

## Permissions (mig 117)

| Code | Usage typique |
|------|----------------|
| `platform:acquisition:read` | Overview, listes, portal snapshot, journeys read |
| `platform:acquisition:manage` | CRUD présentations, prospects, leads, applications, analytics write |
| `platform:acquisition:review` | Transitions review, start qualification, request info |
| `platform:acquisition:approve` | Decide qualification |
| `platform:acquisition:forms:manage` | Schemas / draft versions / document requirements |
| `platform:acquisition:forms:publish` | Publish form versions |
| `platform:acquisition:documents:review` | Review documents |
| `platform:acquisition:quotes:manage` | Quote request / refs / accept |
| `platform:acquisition:checkout:operate` | Checkout, payment refs, handoffs |
| `platform:acquisition:analytics:read` | Funnel |
| `platform:acquisition:governance:manage` | Journey advance, communications |

Grant initial : rôle `EDGE_PLATFORM_SUPER_ADMIN` uniquement (`ON CONFLICT DO NOTHING`).

## Auth tests

`acquisition.controller.auth.spec.ts` — matrix permissions présente (domain/unit).

## Public

Routes `edge/acquisition/public/*` marquées `@Public()` — hors matrice Bearer.

## Statut

**Permissions seed + enforcement controllers DONE.** Rôles métier fins (sales ops, reviewer-only) hors SUPER_ADMIN **à provisionner** selon org.
