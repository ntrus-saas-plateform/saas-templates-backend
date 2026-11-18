# 03 — Dépendances croisées Edge ↔ BB

## 1. Chemin critique (bloquant monétisation réelle)

```text
E0 / B0  ADR & doctrine
    ↓
E1 Contenu marché + capabilities status
    ↓
E2 Packages / Plans / Price books  ──────────────┐
    ↓                                            │
E3 Configurator                                  │
    ↓                                            │
E6 Acquisition / E5 Sales                        │
    ↓                                            │
E7 Entitlements publish  ←───────────────→  B1 Projection
    ↓                                            │
E8 Billing cash truth                            │
    ↓                                            ↓
E9 CS / Expansion  ←──── usage events ────  B2 Orgs + B5 Activation + B6 Metering
    ↓
E10 Revenue certifiable
```

Sans **E7 ↔ B1**, le GTM reste une démo.

---

## 2. Matrice de dépendances

| Livrable | Dépend de | Bloque |
|----------|-----------|--------|
| Publish plan commercial | E1 capabilities status | E2, E3, E4 campaigns |
| Configurator recommendation | E2 | E5 quotes, E6 apply |
| Paid checkout | E2 price book, E6, E8 | E7 provision |
| BB ready=true | E7 entitlements, B1 | Portal activation, E9 |
| Org create (site N) | B2 quotas from entitlements | Expansion revenue |
| Health score | B5/B6 events | E9 renewal |
| MRR MEASURED | E8 cash feed | E10 exec dashboards |
| Campagne paid media | G11 readiness | — |

---

## 3. Contrats d’interface (à figer)

### 3.1 Edge → BB

| API | Payload min | Notes |
|-----|-------------|-------|
| `POST /control/v1/provision` | tenant_id, account_id, subscription_id, product_id, plan_version, entitlements, admin contact | **Prod : entitlements non vides** |
| `PUT .../tenants/{id}/entitlements` | version, capabilities, quotas, limits, flags | Idempotent |
| `POST suspend/resume/archive` | motif + correlation | Aligné lifecycle Edge |

### 3.2 BB → Edge

| Event / API | Usage |
|-------------|--------|
| tenant.ready / state | Portal + readiness |
| entitlement.applied / drift | Reconcile |
| usage.threshold / quota.approaching | Expansion signals |
| activation.milestone / aha.event | CS health |
| org.created / org.limit_denied | Quotas |

### 3.3 Checklist contrats

- [ ] OpenAPI control/v1 version pin partagée
- [ ] Consumer-driven contract tests Edge↔BB CI
- [ ] Capability registry artifact BB → ingest Edge (W2)
- [ ] M2M auth prod documentée
- [ ] Idempotency keys sur provision / entitlements

---

## 4. Séquence calendaire synchronisée

| Fenêtre | Edge | BB | Gate |
|---------|------|----|------|
| S0–1 | E0 | B0 | G0 |
| S1–4 | E1, E2 | B1 start, B3 | G1 start |
| S4–8 | E3, E4, E5 | B2, B4 | G2 |
| S6–12 | E6, E7, E8 | B1 close, B5, B6 | G3–G5 |
| S8–14 | E9, E10 | B8 Pharma | G6–G8 |
| S12–18 | E11, Restaurant GTM | B8 Restaurant | G11 scale |
| Continu | E12 | B7, B9 | G9–G10 |

---

## 5. Risques d’intégration

| Risque | Mitigation | Owner |
|--------|------------|-------|
| Lab entitlements vides en prod | Fail-closed adapter + gate G4 | Edge |
| Multi-profil sous un tenant | ADR-021/055 + refactor tests | BB |
| Drift entitlements | Reconcile job + alert | Edge+BB |
| MRR sans cash | Bloquer MEASURED | RevOps |
| Campagne avant readiness | Gate G11 obligatoire | Product |

### Suivi risques

- [ ] Registre risques hebdo à jour
- [ ] Alerte drift entitlements en staging
- [ ] Alerte payment failure → CS/Finance

---

## 6. Definition of Done intégration

- [ ] Golden path Syntix Wholesale cross-repo PASS
- [ ] Golden path Restaurant multi-org PASS
- [ ] Groupe 2 tenants (Pharma+Restaurant) PASS
- [ ] Chaos : BB down → Edge fail-closed honest
- [ ] Chaos : entitlement publish fail → pas de ready silencieux
