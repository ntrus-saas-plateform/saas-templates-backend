# Audit BE↔FE — repasse 2026-11-18 (après clôture vague)

## Verdict

**Couverture clients console : OK** — `uncoveredConsole: 0` (exact-first + `--strict`).  
**Inventaire CI : OK** — `--check` fail-closed, drift `[]`.  
**Profondeur UI : studio sur domaines densés + provisioning depth** — kit `EdgeStudioShell` + `?section=` ; cœurs métier + agents/cert/recon/keycloak/verticals + Catalog detail / BB / Admins / Security migrés.  
**Ne pas confondre** : shell studio ≠ Legal wet-ink / P10 PUBLISH / Product Tenant **AVAILABLE** (gates humains inchangés).

| Métrique | Valeur |
|---|---:|
| Handlers Nest Edge | **921** |
| Méthodes `edgeApi` (extract) | **908** |
| Pages App Router (extract) | **71** (console ~59 + acq. publique ~6 + BFF) |
| `uncoveredConsole` | **0** |
| `beOnly` (tous OOS) | **10** |
| `feOnly` | **9** |
| OutOfScope patterns | **7** |
| Drift inventaire `--check` | **0** |

Commandes :

```bash
pnpm edge:routes:extract
pnpm edge:routes:check
pnpm edge:routes:diff -- --strict
```

---

## A. Couverture routes (honnête)

### `beOnly` = hors console (OutOfScope)

| Path | Raison |
|---|---|
| `/edge/billing/webhooks/payments` | Webhook PSP |
| `/edge/marketing/deliveries/webhooks/resend` | Webhook delivery |
| `/edge/marketing/deliveries/webhooks/whatsapp` | Webhook delivery |
| `/edge/product-controls/callbacks/:param` | Ingress M2M BB→Edge |
| `/edge/integrations/p5/provisioning/revocations` | M2M P5 |
| `/edge/workflow-workers/claim` | Worker interne |
| `/edge/workflow-workers/heartbeat` | Worker interne |
| `/edge/workflow-workers/steps/:param/complete` | Worker interne |
| `/edge/workflow-workers/steps/:param/fail` | Worker interne |
| `/edge/workflow-workers/steps/:param/renew` | Worker interne |

→ **Aucun trou console** : ces 10 ne doivent pas avoir d’UI admin.

### `feOnly` = FE sans match Nest exact (BFF / alias / extract)

| Path | Lecture |
|---|---|
| `/commission/plans` | Alias / surface revenue FE |
| `/edge-auth/session` | BFF session cookie |
| `/edge-bootstrap` | Bootstrap console |
| `/product-controls/credentials` | BFF credentials (pas 1:1 Nest list) |
| `/product-controls/endpoints/:param/contracts` | Sous-ressource FE |
| `/product-controls/endpoints/:param/health-checks` | Historique health FE |
| `/product-controls/endpoints/:param/history` | Historique FE |
| `/product-controls/exchanges` | Surface FE exchanges |
| `/resources/:param/restore` | Action infra FE |

→ Pas des « routes BE manquantes » ; écart de normalisation / BFF.

---

## B. Profondeur UI par domaine (repasse)

Grade : `missing` | `mvp` | `partial` | `studio`.  
Critère `studio` : `EdgeStudioShell` (header + rail `?section=` + main) + 4 états via `states.tsx` + anti-UUID prioritaire.  
Source depth : [FE depth audit](4961e3a0-9fd0-48fe-a7bb-99bd0a490d39) + migration Studio Phases 0–6.

| Domaine | Grade | Preuve courte |
|---|---|---|
| Auth / Admins / Security | **studio** | login gate réelle + audit export ; admins list/detail + security sections → shell + `?section=` |
| Verticals / Catalog / BB | **studio** | verticals + catalog `[productId]` + backends → `EdgeStudioShell` |
| Markets / Product-control | **studio** | `markets/page` + `provisioning/product-controls` → shell + sections |
| Tenants / Provisioning-requests | **studio** | tenant list/detail modules → `EdgeStudioShell` + `?section=` |
| Subscriptions / Billing | **studio** | groupes Accounts / Invoices / Lifecycle ; deep-link sections |
| Acquisition admin + public | **studio** | admin module shell + draft preview ; pages `/acquire/**` BFF (PUBLISH = Legal) |
| Commercial | **studio** | shell + groupes Catalog / Markets / Packages |
| Marketing | **studio** | shell + groupes Campaigns / Journeys / Content |
| Sales | **studio** | shell + groupes Pipeline / CRM / Quotes ; `?section=pipeline` |
| Revenue / CS / Onboarding | **studio** | revenue + onboarding shells ; CS signals API-only |
| Platform Operations | **studio** | shell + groupes ; `?section=incidents` + `?incident=` |
| Provisioning depth (agents/cert/recon/infra) | **studio** | registry/capacity/infra/workflows + agents/cert/recon/keycloak en shell |

**Domaines `studio` :** Sales, Ops, Marketing, Billing, Subs, Commercial, Acquisition, Revenue/Onboarding, Tenants, Markets, Product-control, Provisioning depth, Catalog detail / BB, Auth/Admins/Security.  
**Restent `partial` :** aucun des domaines densés (uniquement surfaces 1–2 onglets hors kit si nécessaire). **Aucun `missing`.**

### Restes paste-UUID (volontaires ou fallback)

Select-first via `ListOrUuidField` partout où une list API existe. Paste encore visible / fallback :

- `productTenantId` register (id externe BB — pas de list API)
- publication status (pas de GET list — ids session + fallback)
- capacity `Provisioning request ID` (picker list quand dispo ; fallback UUID)
- fallbacks `ListOrUuidField` (handoff, productId, tenant, application, etc.) quand liste vide

---

## C. Ce qui est vraiment fermé vs ouvert

### Fermé (preuve machine)

- [x] `uncoveredConsole: 0` + `--strict`
- [x] Inventaire artifacts = CI fail-closed
- [x] Clients Sales/Billing/Commercial/Marketing console branchés
- [x] Anti-MVP select-first prioritaire
- [x] e2e P0 packs (opt-in) + lab golden + retail/hospitality **PASS**
- [x] Incident deep-link ops
- [x] Kit `EdgeStudioShell` + migration domaines densés (Phases 0–6)
- [x] e2e studio smoke non-lab — `e2e/edge-studio-smoke.spec.ts` + `pnpm test:e2e:studio` / `test:e2e:p0` (gate anonyme ; rails auth opt-in `EDGE_E2E_AUTH=1`)

### Ouvert (honnête)

- [x] Catalog detail / BB / Admins / Security → `EdgeStudioShell` + `?section=`
- [ ] 4 états + breadcrumbs uniformes sur 100 % des pages restantes
- [ ] e2e P0 verts **en CI continue authentifiée** (rails studio auth = opt-in ; anonyme déjà dans `test:e2e:p0`)
- [ ] Parité acquisition admin↔public + P10 PUBLISH (gate Legal — plan 39)
- [ ] Product Tenants Retail/Hospitality **AVAILABLE** uniquement après G11 sign-off (lab ≠ go-live)

---

## D. Interprétation

| Question | Réponse |
|---|---|
| « Toutes les routes console ont un client FE ? » | **Oui** (`uncoveredConsole: 0`) |
| « La console est studio-grade partout ? » | **Oui** sur les domaines densés + Catalog/BB/Admins/Security ; gates humains Legal/AVAILABLE hors scope |
| « Les 10 beOnly sont des oublis ? » | **Non** — OOS M2M/webhooks/workers |
| « On peut claim AVAILABLE / 50k/s ? » | **Non** |

**Score couverture clients : A.**  
**Score profondeur UX : B / B+** (studio sur domaines RGOM densés ; pas encore 100 % console ; Legal/AVAILABLE hors scope code).
