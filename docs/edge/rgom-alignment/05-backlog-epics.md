# 05 — Backlog Epics (Edge + intégration)

Format ticket suggéré : `RGOM-E{n}.{m}` / `RGOM-X{n}` (cross) / voir BB `RGOM-B{n}.{m}`.

---

## Epics Edge

### Epic E0 — Doctrine lock

| ID | Titre | Priorité | Dépendances |
|----|-------|----------|-------------|
| RGOM-E0.1 | Publier ADR-021 + index | P0 | — |
| RGOM-E0.2 | Matrice SoT + readiness gate template | P0 | E0.1 |
| RGOM-E0.3 | Enforcement checklist PR template | P1 | E0.2 |

### Epic E1 — Market content Syntix

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E1.1 | Seed segments + profiles + operating models | P0 | DONE seed 126 + `seed:rgom:syntix` |
| RGOM-E1.2 | ICP + personas + committees | P0 | ICP+personas DONE ; committees engine exists |
| RGOM-E1.3 | Capability commercial status audit beachhead | P0 | DONE AVAILABLE beachhead caps |
| RGOM-E1.4 | Restaurant taxonomy + ICP v0 | P1 | DONE 132 + catalog TS |
| RGOM-E1.5 | Other verticals taxonomy only | P2 | DONE Retail/Edu/Logistics |

### Epic E2 — Packaging & pricing

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E2.1 | Solution packages Syntix | P0 | DONE |
| RGOM-E2.2 | Plan compositions Lite→Enterprise | P0 | DONE + entitlementSnapshot |
| RGOM-E2.3 | Add-ons + eligibility | P0 | DONE |
| RGOM-E2.4 | Price books + units + geo | P0 | DONE DRAFT books + geo rules CI/XOF |
| RGOM-E2.5 | Discount/approval policies | P1 | DONE DISC_RGOM_BEACHHEAD + API |
| RGOM-E2.6 | Enterprise templates | P1 | DONE doc 29 + publish UC |

### Epic E3 — Configurator

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E3.1 | Domain input model + rules | P0 | DONE wizard + configurator |
| RGOM-E3.2 | Explainability + profile correction | P0 | DONE |
| RGOM-E3.3 | Snapshot→quote/opportunity/acquisition | P0 | DONE snapshot.linkedTo |
| RGOM-E3.4 | FE public configure + console wizard | P0 | DONE acquire `/configure` (plans BFF) ; wizard `offers/wizard` = console auth only |
| RGOM-E3.5 | FE sales console | P1 | DONE API client |
| RGOM-E3.6 | Playwright Wholesale golden | P0 | DONE unit golden ; PW EX |

### Epic E4 — GTM surfaces

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E4.1 | Product IA + segment landings | P0 | DONE doc 26 |
| RGOM-E4.2 | CTA matrix + trust pages | P1 | DONE doc 26 |
| RGOM-E4.3 | Campaign guards Published-only | P0 | DONE |
| RGOM-E4.4 | WhatsApp consent journey | P1 | DONE rules doc |
| RGOM-E4.5 | Attribution honesty wiring | P1 | DONE CAC UNAVAILABLE rule |

### Epic E5 — Sales

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E5.1 | Pipeline exit criteria + scoring | P0 | DONE + API |
| RGOM-E5.2 | Discovery/demo templates | P1 | DONE |
| RGOM-E5.3 | Quote↔configurator | P0 | DONE |
| RGOM-E5.4 | Lost reasons + handoff E2E | P0 | DONE taxonomy + P5/P10 |

### Epic E6 — Acquisition prod

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E6.1 | Close P10 P0/deferred beachhead | P0 | DONE doc 28 + EX |
| RGOM-E6.2 | SMB/mid/enterprise path split | P0 | DONE |
| RGOM-E6.3 | Legal consent review | P0 | CONDITIONAL — legal sign-off |
| RGOM-E6.4 | Customer portal ready status | P1 | DONE MVP shell |

### Epic E7 — Entitlements prod path

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E7.1 | Ban empty entitlements in prod adapters | P0 |
| RGOM-E7.2 | Publish+reconcile BB | P0 | DONE + drift-scan batch |
| RGOM-E7.3 | Lifecycle upgrade/suspend | P0 | DONE upgrade keep-tenant + suspend/grace/reactivate↔dunning policy |
| RGOM-E7.4 | Association cardinality tests | P0 | DONE domain + bind + plan-change keep-tenant |

### Epic E8 — Billing cash

| ID | Titre | Priorité | Statut |
|----|-------|----------|--------|
| RGOM-E8.1 | Dunning/grace/restriction | P0 | DONE policy + apply/scan + notify queue |
| RGOM-E8.2 | P11 cash feed executable | P0 | DONE cash-truth triad + F-P11-001 engine |
| RGOM-E8.3 | Geo payments beachhead | P1 | DONE WAEMU MM catalog + gated register |
| RGOM-E8.4 | Cadence / setup fees / HyperSwitch arch | P0 | DONE |

### Epic E9 — CS

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E9.1 | Playbooks + Aha events | P0 | DONE 3 playbooks + registry + ingest API |
| RGOM-E9.2 | Health score v1 | P0 | DONE UNAVAILABLE≠0 + touch model |
| RGOM-E9.3 | Renewal + expansion signals | P0 | DONE playbook + expansion quote path + churn |

### Epic E10 — Revenue cert

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E10.1 | Close P11 P0 | P0 | DONE CODE_COMPLETE + EX signed |
| RGOM-E10.2 | Honest console + forecasts | P1 | DONE named scenarios + honesty doc |
| RGOM-E10.3 | Re-audit package | P0 | DONE exceptions `20` ; ACCEPTED lab open |

### Epic E11 — Partners / ABM

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E11.1 | Partner program MVP | P2 | DONE rules + opportunity API 131 |
| RGOM-E11.2 | Enterprise ABM templates | P2 | DONE templates 18 |

### Epic E12 — Prod hardening

| ID | Titre | Priorité |
|----|-------|----------|
| RGOM-E12.1 | CI golden path + Playwright | P0 | DONE beachhead + EX-E12-PW/CI |
| RGOM-E12.2 | Remote reproducibility | P0 | DONE EX-E12-PUSH signed |
| RGOM-E12.3 | Runbooks + observability | P0 | DONE 19–22 + rollback 21 |

---

## Epics cross-repo

| ID | Titre | Repos | Priorité |
|----|-------|-------|----------|
| RGOM-X1 | Contract tests control/v1 | Edge+BB | P0 |
| RGOM-X2 | Golden path Wholesale paid→ready→aha | Edge+BB+FE | P0 |
| RGOM-X3 | Golden path Restaurant multi-org | Edge+BB+FE | P0 |
| RGOM-X4 | Groupe 2 product tenants | Edge+BB | P0 |
| RGOM-X5 | Capability registry ingest sync | Edge+BB | P0 |
| RGOM-X6 | Go-live evidence pack | All | P0 |

---

## Definition of Ready (ticket)

- [ ] Critères d’acceptation testables
- [ ] Lien ADR / plan section
- [ ] Owner nommé
- [ ] Dépendances listées
- [ ] Risque / rollback noté si mutation prod

## Definition of Done (ticket)

- [ ] Code + tests
- [ ] Docs mises à jour
- [ ] Checklist plan parente cochée avec preuve
- [ ] Pas de promesse capability Planned
- [ ] Feature flag / mig safe
