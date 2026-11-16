# 22 — Audit Edge Admin Console (P11)

| Champ | Valeur |
|-------|--------|
| FE path | `saas-template-frontend/components/edge/revenue-operations/edge-revenue-module.tsx` |
| Route | `/edge/revenue` |
| Gate E | **FAIL** |
| Verdict | MVP **10 onglets** ≠ mandat **30 sections** |

## Onglets livrés (E3)

| Tab | Permission déclarée |
|-----|---------------------|
| Overview | `platform:revenue:read` (+ bypass visibility `business:read`) |
| Metrics | `platform:revenue:read` |
| MRR | `platform:revenue:read` |
| Retention | `platform:revenue:read` |
| Renewals | `platform:revenue:read` |
| Forecasts | `platform:revenue:forecast` |
| Assurance | `platform:revenue:reconcile` |
| Commissions | `platform:commission:read` |
| Alerts | `platform:business:read` |
| Reports | `platform:business:governance:manage` |

## Mapping ~30 sections mandatées (synthèse adversarial)

| Statut | Count approx. | Exemples |
|--------|---------------|----------|
| **PRESENT** | ~14 | Overview, metrics, MRR, retention, renewals, forecasts, assurance, commissions, alerts, reports, (API-backed subsets) |
| **API_ONLY** | ~4 | Targets/planning, audit governance, leakage deep-dive, business decisions |
| **ABSENT** | ~12 | Partners, FX/geo, unit economics UI, product profitability UI, cohort explorer, logo churn, collected/invoiced dashboards, etc. |

→ Gate E **FAIL** ([F-P11-011](./34-findings-and-risk-register.md)).

## Permission mismatch — P1

Overview visible si `platform:business:read` **sans** `platform:revenue:read`, mais `overviewQuery` appelle `getRevenueOverview()` protégé backend par `@RequireEdgePermissions('platform:revenue:read')`.

| ID | Sévérité | Impact |
|----|----------|--------|
| **F-P11-010** | P1 | UX trompeuse / 403 ; faille d’alignement RBAC FE↔BE |

Evidence FE :

```tsx
(t.id === "overview" &&
  hasAnyEdgePermission(permissions, [
    "platform:revenue:read",
    "platform:business:read",
  ]))
```

## Tests FE audit

`npx vitest run components/edge/revenue-operations` → **1 file / 5 passed** (cet audit).

## Verdict

Console **honest MVP**, **pas** enterprise 30-section IA.
