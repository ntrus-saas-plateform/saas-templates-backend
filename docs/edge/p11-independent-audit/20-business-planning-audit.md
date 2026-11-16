# 20 — Audit business planning & targets (P11)

| Champ | Valeur |
|-------|--------|
| API | `POST/GET edge/business/targets` |
| Permissions | `platform:business:targets:manage` / `business:read` |
| Tables | `edge_p11_revenue_targets`, `edge_p11_business_periods` |
| Console | **ABSENT** (pas d’onglet Planning) |
| Verdict | **API_ONLY** |

## Evidence

Controller expose targets ; FE `TABS` ne contient pas planning/targets. Classification console : API_ONLY ([F-P11-011](./34-findings-and-risk-register.md) contribution).

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-031 | P2 | Pas de variance analysis UI plan vs actual |
| F-P11-002 | P0 | Scénarios planning E2E non exécutés |

## Verdict

Planning schema/API **embryonnaire**. Enterprise planning **FAIL**.
