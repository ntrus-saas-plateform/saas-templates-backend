# Plan d’alignement Edge Backend ↔ Frontend

> Cohérence **extrême** pilotage plateforme (tenants, abo, billing, BB) — hors ERP métier.
>
> Artefacts : [`edge-backend-routes.md`](./edge-backend-routes.md) · [`edge-frontend-routes.md`](./edge-frontend-routes.md) · `edge-routes.extract.json`
>
> Régénération : `python saas-templates-backend/scripts/extract-edge-routes.py`

## 0. Chiffres clés

| Métrique | Valeur |
|---|---:|
| Handlers Nest Edge | **927** |
| Méthodes `edgeApi` | **905** |
| Pages console | **59** |
| Pages acquisition publique | **6** |
| Paths BE matchés (heuristique) | 731 / 741 |
| Paths BE sans client FE | **10** |
| Paths FE sans match BE | **2** |

### Verdict

Le backend Edge est une **control plane complète** (~900 handlers). Le frontend a une **bonne ossature de pages** (~60+) et un client API dense (~700 méthodes), mais la profondeur UI reste **inhomogène** : certains domaines sont studio-grade (verticals/catalog/BB en cours), d’autres sont des modules MVP (sales/marketing) ou des listes sans toutes les transitions BE.

**Objectif d’alignement :** chaque handler console-scopé a (1) client typé, (2) consommateur UI ou annotation `OutOfScope`, (3) permissions, (4) 4 états UI, (5) smoke e2e P0/P1.

## 1. Matrice domaines

| Domaine | Priorité | #routes BE | Pages FE | Lecture statut |
|---|---|---:|---|---|
| Auth / Admins / Security / Workspaces | P0 | 35 | `/edge/administrators`, `/edge/administrators/[id]`, `/edge/audit`, `/edge/login`, `/edge/security`, `/edge/workspace` (+2) | 🟢 Surface large — compléter mutations + e2e |
| Verticals / Products / Catalog / Backends | P0 | 64 | `/edge`, `/edge/backends`, `/edge/catalog`, `/edge/catalog/[productId]`, `/edge/catalog/new`, `/edge/markets` (+4) | 🟢 Surface large — compléter mutations + e2e |
| Product Control (BB hub) | P0 | 19 | `/edge/provisioning/product-controls`, `/edge/provisioning/product-controls/endpoints/[id]`, `/edge/provisioning/product-controls/exchanges/[id]` | 🟢 Surface large — compléter mutations + e2e |
| Tenants & Provisioning requests | P0 | 63 | `/edge/provisioning-requests`, `/edge/provisioning-requests/[id]`, `/edge/tenants`, `/edge/tenants/[id]` | 🟢 Surface large — compléter mutations + e2e |
| Subscriptions | P1 | 55 | `/edge/subscriptions`, `/edge/subscriptions/[id]` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Billing | P1 | 70 | `/edge/billing`, `/edge/billing/portal` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Acquisition admin + public | P1 | 65 | `/edge/acquisition` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Commercial | P2 | 64 | `/edge/commercial`, `/edge/commercial/plans/[id]` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Marketing | P2 | 52 | `/edge/marketing` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Sales + Partner opportunities | P2 | 103 | `/edge/sales`, `/edge/sales/opportunities/[id]` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Revenue + Customer Success | P2 | 41 | `/edge/revenue` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Platform Operations | P1 | 70 | `/edge/operations` | 🟠 Page(s) présentes — profondeur MVP / partielle |
| Provisioning depth (Registry→Evidence+KC) | P1 | 225 | `/edge/provisioning-requests`, `/edge/provisioning-requests/[id]`, `/edge/provisioning/agents`, `/edge/provisioning/capacity`, `/edge/provisioning/capacity/decisions/[id]`, `/edge/provisioning/capacity/requests/[id]` (+21) | 🟢 Surface large — compléter mutations + e2e |
| Workers / M2M / Lab status | P3 | 8 | — | Hors console (M2M/lab) — documenter seulement |
| Acquisition publique (sites) | P1 | (voir acquisition-public) | `/acquire/[slug]/apply`, `/acquire/[slug]/configure`, `/acquire/[slug]`, `/acquire/checkout/[sessionId]`, `/acquire` | 🟢 Parcours public — parity admin |

## 2. Écarts path-level

### 2.1 Backend sans client FE évident

Count: **10**. Prioriser les paths `platform` console ; ignorer workers après annotation.

<details><summary>Liste complète BE-only</summary>

| Path normalisé |
|---|
| `/edge/billing/webhooks/payments` |
| `/edge/integrations/p5/provisioning/revocations` |
| `/edge/marketing/deliveries/webhooks/resend` |
| `/edge/marketing/deliveries/webhooks/whatsapp` |
| `/edge/product-controls/callbacks/:param` |
| `/edge/workflow-workers/claim` |
| `/edge/workflow-workers/heartbeat` |
| `/edge/workflow-workers/steps/:param/complete` |
| `/edge/workflow-workers/steps/:param/fail` |
| `/edge/workflow-workers/steps/:param/renew` |

</details>

### 2.2 Client FE sans match BE évident

Count: **2** (souvent BFF auth/bootstrap ou alias path).

<details><summary>Liste FE-only</summary>

| Path normalisé |
|---|
| `/edge-auth/session` |
| `/edge-bootstrap` |

</details>

## 3. Zones MVP / incomplètes — couverture obligatoire

Pour chaque zone : **interdit** de laisser un handler « mort » sans UI ou sans `OutOfScope`.

### 3.1 Sales (critique écart volume)

- BE : `sales.controller` + `sales-platform` + partners ≈ 100 handlers.
- FE : `/edge/sales` + opportunity detail — **MVP**.
- Compléter : pipeline board, transitions stage, activities, quotes, assignation, permissions, empty/error (fix TS props).

### 3.2 Marketing

- BE journeys/campaigns/WAIT ≈ 50 handlers.
- FE module unique — mapper chaque onglet → endpoints ; runtime status worker.

### 3.3 Commercial

- Plans / price books / availability / publication.
- Detail plan existe — couvrir toutes mutations lifecycle.

### 3.4 Billing & Subscriptions

- BE très dense (70 billing + 54 subscriptions).
- FE list/detail/portal — viser parité Stripe : invoice detail, retries, dunning, change-plan, pause/cancel, entitlements, credit notes si exposés.

### 3.5 Acquisition

- Admin inbox + public checkout/apply.
- Compléter : décisions qualification, documents, handoff subscription, analytics funnel, honest lab badges.

### 3.6 Revenue + CS

- Revenue module présent ; CS (`edge/cs`) souvent **sans page dédiée** → hub CS ou section Revenue.

### 3.7 Operations

- 70 handlers ops — UI tabbed existe.
- Compléter deep-links header inbox → alert/incident ; automation approvals ; status page publication.

### 3.8 Tenants & provisioning-requests

- Toutes transitions d’état + health snapshots + evidence isolation branchées en boutons (pas read-only).

### 3.9 Product Control / Backends

- Handshake, health-check, exchanges, capabilities, bindings catalog — parcours bout-en-bout lab.

### 3.10 Provisioning depth

- Chaque sous-page (registry, capacity, workflows, infra, config, experience, readiness, lifecycle, onboarding, reconciliation, agents, certification, evidence, keycloak) :
  - list + detail + create + transition + permission gate + evidence viewer link.

### 3.11 Verticals studio

- Lifecycle vertical, memberships, config versions, products — déjà avancé ; fermer les handlers restants.

### 3.12 Workers / live-complete

- Pas d’UI CRUD ; badge opérateur + docs runbook lab.

## 4. Plan d’exécution avancé

### Phase 0 — Gouvernance contrat (3–5 j)

1. CI : régénérer ce trio `.md` + fail si drift JSON non commité.
2. Annotation Nest `@ConsoleScope('in'|'out')` ou fichier allowlist OutOfScope.
3. Export OpenAPI Edge filtré `edge/**` comme source de vérité DTO.
4. Script `edge:routes:diff` : BE handler sans `edgeApi` + sans OutOfScope = erreur.

### Phase 1 — Client API 100% console-scopé (2 sprints)

Ordre : P0 → P1 → P2.

DoD méthode `edgeApi` :
- path exact runtime
- types réponse/body
- `EdgeApiError`
- queryKey factory documentée

### Phase 2 — UI complète anti-MVP (3 sprints)

Template page domaine :

```
List (filters/paging/states)
  → Detail (status + actions lifecycle)
    → Nested resources tabs
      → Audit / evidence
```

Règles :
- Aucun bouton cosmétique
- Confirm dialog sur transitions destructives
- `EdgePermissionGate` + message forbidden
- Badges honest CODE_COMPLETE / NEED_LAB_RUN

### Phase 3 — Shell & discoverability (1 sprint)

1. Accordion nav (fait) + deep-link
2. Command menu = union pages + create actions + jump vertical
3. Header status/inbox → ops detail
4. Breadcrumbs sur tous les `[id]`

### Phase 4 — Qualité & anti-dérive (continu)

| Contrôle | Fréquence |
|---|---|
| Diff routes CI | chaque PR |
| E2E smoke P0 | chaque PR |
| E2E domaine P1 | nightly |
| Audit MVP (% handlers branchés) | bi-hebdo |
| Contract test OpenAPI | chaque PR API |

### Phase 5 — Fermeture MVP par domaine

| Sprint focus | Domaine | Exit criteria |
|---|---|---|
| S1 | Verticals/Catalog/BB/Product-control | 100% handlers P0 wired + e2e lab provision |
| S2 | Tenants + provisioning-requests + registry/workflows | transitions UI = BE |
| S3 | Subscriptions + Billing + Acquisition | parity actions critiques Stripe-like |
| S4 | Ops + Capacity/Infra/Config | alert loop + health |
| S5 | Commercial/Marketing/Sales | plus de modules « démo » |
| S6 | Revenue/CS + polish provisioning | hub CS + evidence |

## 5. Checklist d’acceptation « cohérence extrême »

- [ ] 100% handlers console-scopés → `edgeApi`
- [ ] 100% `edgeApi` → UI ou OutOfScope daté
- [ ] 100% pages : permission + 4 états + breadcrumbs
- [ ] 0 DTO inventés (OpenAPI/types partagés)
- [ ] E2E P0/P1 verts
- [ ] Docs routes = artifact CI sans drift
- [ ] Aucun faux « production ready » (statuts lab honest)
- [ ] Sales/Marketing/Billing sortis du statut MVP

## 6. Top contrôleurs par volume (charge d’alignement)

| Fichier | #routes |
|---|---:|
| `sales.controller.ts` | 75 |
| `billing.controller.ts` | 70 |
| `platform-operations.controller.ts` | 70 |
| `commercial.controller.ts` | 64 |
| `subscription.controller.ts` | 55 |
| `acquisition.controller.ts` | 53 |
| `tenant-management.controller.ts` | 53 |
| `marketing.controller.ts` | 52 |
| `revenue-operations.controller.ts` | 35 |
| `registry.controller.ts` | 33 |
| `workflow.controller.ts` | 29 |
| `sales-platform.controller.ts` | 25 |
| `verticals.controller.ts` | 25 |
| `catalog.controller.ts` | 21 |
| `configuration.controller.ts` | 20 |
| `placement.controller.ts` | 20 |
| `product-control.controller.ts` | 19 |
| `products.controller.ts` | 18 |
| `experience.controller.ts` | 17 |
| `infrastructure.controller.ts` | 17 |
| `keycloak.controller.ts` | 16 |
| `reconciliation.controller.ts` | 15 |
| `onboarding.controller.ts` | 13 |
| `acquisition-public.controller.ts` | 12 |
| `activation.controller.ts` | 11 |
| `administrators.controller.ts` | 11 |
| `certification.controller.ts` | 11 |
| `security.controller.ts` | 11 |
| `connectivity-agent.controller.ts` | 9 |
| `lifecycle.controller.ts` | 8 |
| `provisioning.controller.ts` | 7 |
| `workspaces.controller.ts` | 7 |
| `authorization.controller.ts` | 6 |
| `customer-success.controller.ts` | 6 |
| `workflow-worker.controller.ts` | 6 |
| `partner-opportunity.controller.ts` | 3 |
| `provisioning-jobs.controller.ts` | 2 |
| `live-complete.controller.ts` | 1 |
| `p5-provisioning-integration.controller.ts` | 1 |

## 7. Mapping BFF

```
Browser  →  Next /api/edge-auth/*          (session)
        →  Next /api/edge-bootstrap       (me, workspaces, permissions)
        →  Next /api/edge-backend/<path>  (proxy)
              →  Nest /api/v1/<path>
```

Toute nouvelle route Nest `edge/**` doit :
1. apparaître dans OpenAPI
2. avoir une méthode `edgeApi`
3. être consommée ou OutOfScope
4. mettre à jour la nav/command palette si page nouvelle

---

_Plan vivant — régénérer après chaque vague contrôleur._
