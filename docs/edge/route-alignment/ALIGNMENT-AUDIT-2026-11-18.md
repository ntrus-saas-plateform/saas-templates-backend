# Audit d’alignement BE↔FE — 2026-11-18

## Verdict

**Couverture clients console : `uncoveredConsole: 0`** (mesure exact-first 2026-11-18).  
**Profondeur UI** : encore partielle / anti-MVP incomplet (méga-onglets, restes paste-UUID volontaires, pas de grade studio bout-en-bout).  
**RGOM** : lab retail/hospitality + golden handshake **PASS** — pas de claim AVAILABLE / 50k/s / wet-ink forgé.

| Métrique | Valeur |
|---|---:|
| Handlers Nest Edge | ~921 |
| Méthodes `edgeApi` | ~838+ |
| Pages console | 59 |
| Pages acquisition publique | 5 |
| `uncoveredConsole` (hors OOS) | **0** |
| `beOnly` OOS | 10 |
| `feOnly` | 9 (BFF / extract) |
| Drift docs inventaire (`--check`) | **OK** fail-closed |

## Ce qui est réellement fait

- Ossature console large (59 pages) + client dense
- P0 auth/admins/security/catalog/markets/tenants : surface utilisable
- Ops : major-incidents, status-pages, approve publication
- Clients + UI fine commercial/sales/marketing/revenue/billing
- Acquisition admin : leads promote, from-contract, transition
- Jobs async : clients `provisioning-jobs` + UI subscription detail
- OutOfScope correct pour M2M / webhooks / public / workers
- CI `edge:routes:check` **fail-closed** + `--strict` OK
- Lab `lab:golden:handshake` + `lab:e2e:retail|hospitality` **PASS**

## Ce qui manque encore (honnête)

### A. Clients manquants (console)

| Domaine | # approx | Exemples |
|---|---:|---|
| Sales | 0 (fermés UI fine) | quotes/orders/accounts/opportunity workspace |
| Billing | 0 (fermés UI fine) | schedules, disputes, collections, journal/parties |
| Commercial | 0 (fermés UI fine) | capabilities link, research, segment score |
| Marketing | 0 (fermés) | campaign get, journey executions, lead get/consent withdraw |
| Autres (volontaire / OOS / sans list API) | ~feOnly 9 + restes | webhooks, periodId, productTenant register, publications sans GET list |

### B. Profondeur UI encore MVP / partielle

Audit FE depth ([Workspace](5ac221aa-a9aa-4a4b-8c25-2cb2e6a2bcee)) : **aucun domaine studio-grade de bout en bout** ; rien de totalement *missing*, mais motif récurrent méga-onglets + UUID à coller.

| Domaine | Grade | Preuve courte |
|---|---|---|
| Auth / Admins / Security | partial | `edge-auth-gate` ; `login/page.tsx` → `null` ; audit = table seule |
| Verticals / Catalog / Markets / BB / Product-control | partial | studios lourds ; `backends` encore registre fin |
| Tenants + provisioning-requests | partial | modules ~1,8–1,9k L ; IDs produit/tenant collés |
| Subscriptions + Billing | partial | 13 / 8 onglets ; handoff UUID ; portal `accountId` saisi |
| Acquisition admin + public | partial | module ~2,4k L ; `/acquire/**` appelle BFF ; UUID dans admin |
| Commercial | partial | `commercial/page.tsx` ~2k L / 11 onglets |
| Marketing | partial | ~2k L / 15 onglets ; studio éditeur non généralisé |
| Sales | partial | ~2,5k L / 18 onglets ; lead UUID ; pas CRM guidé |
| Revenue / CS | partial | métriques/assurance ; peu de file CS « studio » |
| Platform Operations | partial | module ~2,7k L ; paste publication id |
| Provisioning depth | partial | registry/workflows/capacity riches ; recon/capacity encore UUID |

Checklist plan encore ouverte :

- [x] Clients console critiques branchés (`uncoveredConsole: 0`)
- [x] Docs routes = artifact CI sans drift (`--check` fail-closed)
- [ ] Sales/Marketing/Billing sortis du statut *profondeur* MVP (UI fine ≠ studio)
- [ ] 100% pages : 4 états + breadcrumbs partout
- [ ] E2E P0/P1 verts en CI continue (packs opt-in existent)

### C. Acquisition publique

- 5 pages `/acquire/**` existent + clients `/api/acquisition-public/**`
- Routes Nest `acquisition/public/**` sont OutOfScope console (volontaire)
- Parité admin↔public / seed presentations : **pas fermée** (voir aussi plan 39 W2)

### D. Plan 39 (Edge↔BB / Product Tenants) — autre axe

Hors route-alignment strict : Retail/Hospitality encore **PLANNED** (lab PASS ≠ AVAILABLE) ; jobs async H1 + Grafana JSON prêts ; warm pool scaffold **OFF** ; G11 badge FE sans auto-AVAILABLE (doc `39`).

## Interprétation

| Couche | État |
|---|---|
| Inventaire + tooling | 🟢 présent (à régénérer) |
| Couverture client console | 🟠 ~94% heuristique honnête ; **~59 trous** |
| Profondeur anti-MVP | 🟠 / 🔴 selon domaine (Sales/Billing surtout) |
| Lab / e2e / claims prod | 🔴 non fermé |

## Suite recommandée (ordre)

1. Régénérer artefacts (`edge:routes:extract`) + commit → `--check` fail-closed  
2. Fermer les **59** uncovered clients (priorité Sales → Billing → Commercial)  
3. Remplacer les flux « paste UUID » par sélections liées aux listes  
4. Pack e2e P0 (auth → catalog → tenant → BB handshake)  
5. Enchaîner plan 39 Phase A (Product Tenants PLANNED + jobs) sans claims d’échelle
