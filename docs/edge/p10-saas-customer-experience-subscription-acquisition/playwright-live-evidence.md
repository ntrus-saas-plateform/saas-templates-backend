# P10 — Playwright live evidence (frontend)

**Nature :** live browser + BFF/public proxy contracts via Playwright  
**Pas** un remplacement des 40 scénarios domaine Vitest.

| Couche | Artefact | Statut |
|--------|----------|--------|
| Domain / application (§27.6) | `acquisition-scenarios.spec.ts` (backend) | **40 / 40 Pass** — voir [`e2e-scenario-evidence.md`](./e2e-scenario-evidence.md) |
| Live browser / API proxy | `e2e/edge-acquisition-smoke.spec.ts` + `e2e/edge-acquisition-scenarios.spec.ts` (frontend) | Smoke + scénarios live (shells + contrats) |

## Commande

```bash
cd saas-template-frontend
pnpm exec playwright test e2e/edge-acquisition-smoke.spec.ts e2e/edge-acquisition-scenarios.spec.ts --reporter=line
```

`playwright.config.ts` démarre `pnpm dev` sur `http://localhost:3001` si `PLAYWRIGHT_SKIP_WEBSERVER` n’est pas défini (`reuseExistingServer: !CI`).

## Ce que couvre Playwright (live)

| ID / thème | Scénario live | Assertion honnête |
|------------|---------------|-------------------|
| P10-S01 | `/acquire` discovery | Shell + heading ; catalogue peut être vide |
| P10-S02 / S04 | `/acquire/some-slug` | Route structure + branding ; produit peut être indisponible |
| P10-S04 / S07 | `/acquire/.../apply` | Page candidature, **aucun champ carte**, honeypot présent ; challenge UI si backend up |
| P10-S33 / S37 | `/acquire/portal` | Shell portail public (pas d’auth inventée) |
| P10-S26 / S27 | `/acquire/checkout/:id` | Revue checkout, **aucun champ carte** |
| P10-S12 | `GET /api/acquisition-public/challenge` | **200** + shape `challengeId` / `challengeToken` / `operandA` / `operandB`, ou **404/500/502/503** si backend down |
| P10-S07 / S12 | `POST .../leads` sans challenge | Rejet **4xx** (ou 5xx upstream down) — jamais succès inventé |
| P10-S39 | `POST .../analytics/events` | Chemin proxy autorisé (**≠ 400** `VALIDATION_ERROR`) |
| Admin CSRF | `POST /api/edge-backend/acquisition/products` | **403** `CSRF_REJECTED` |
| Gate Edge | `/edge/acquisition` anonyme | Heading Okapi Edge + bouton sign-in |
| Proxy deny | path disallowed (`/secrets`) / `%2e%2e` traversal | **400** `VALIDATION_ERROR` ; encoded `..` may be **404** Next (not forwarded) |
| Proxy allow | `GET .../checkout/:id` | **≠ 400** ; 404/500/502/503 backend OK |

Smoke historique : gate Edge, overview 401/403, CSRF products/checkout, discovery, checkout no-card.

## Ce que Vitest 40/40 couvre (pas Playwright)

Les scénarios **P10-S01…P10-S40** (discovery → form → docs → qualification → quote → checkout → handoff → portal / analytics secrets) restent une **domain/application scenario suite** in-memory — evidence dans [`e2e-scenario-evidence.md`](./e2e-scenario-evidence.md).

Playwright **ne revendique pas** les 40 parcours métier live (paiement P6, handoff P5, malware storage, etc.).

## Exécution

| Condition | Attendu |
|-----------|---------|
| `pnpm dev` déjà up ou webServer Playwright | Specs smoke + scenarios **green** |
| Backend Edge down | Challenge/leads/analytics/checkout : 404/500/502/503 acceptés selon cas ; shells UI restent green |
| Backend up | Challenge 200 + JSON shape ; lead sans challenge 4xx |

### Run local (2026-11-16)

| Métrique | Valeur |
|----------|--------|
| Commande | `pnpm exec playwright test e2e/edge-acquisition-smoke.spec.ts e2e/edge-acquisition-scenarios.spec.ts --reporter=line` |
| Frontend pré-existant | **non** — démarré via `webServer` (`pnpm dev` → `:3001`) |
| Backend Edge | **down** (`ECONNREFUSED` sur proxy public) |
| Résultat | **18 passed** (6 smoke + 12 scenarios) |
| Exit code | `0` |

Si un run manuel est lancé **sans** serveur frontend et avec `PLAYWRIGHT_SKIP_WEBSERVER=1`, les tests échouent à la connexion — ce n’est pas un échec produit ; relancer avec le `webServer` de `playwright.config.ts`.

## Limites (honnêtes)

- Pas de session Edge authentifiée dans ces specs (gate + CSRF seulement).
- Pas de création lead / checkout / handoff « happy path » inventée.
- Full live E2E 40 scénarios métier : **pending** (environnements intégrés + fixtures).
