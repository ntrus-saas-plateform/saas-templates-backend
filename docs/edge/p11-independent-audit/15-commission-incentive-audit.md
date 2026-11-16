# 15 — Audit commissions & incentives (P11)

| Champ | Valeur |
|-------|--------|
| API | plans, calculations, approve |
| Console | Onglet Commissions PRESENT |
| Verdict | Calcul/approbation **API présents** ; payout **hors scope tenu** |

## Endpoints (E3)

| Method | Path | Permission |
|--------|------|------------|
| POST | `edge/revenue/commission/plans` | `platform:commission:calculate` |
| POST | `edge/revenue/commission/calculations` | `platform:commission:calculate` |
| POST | `edge/commission/calculations/:id/approve` | `platform:commission:approve` |
| GET | `edge/revenue/commission/plans` | `platform:commission:read` |

Tables : plans, rules, accruals, calculations, approvals (122).

## Non-négociable

Commission calc ≠ payout execution — **respecté E3** (pas d’intégration payout monétaire dans P11).

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-027 | P2 | Inventaire commission riche / statements partenaires absents |
| F-P11-013 | P1 | Rôles commission incomplets vs matrice mandat entreprise |
| F-P11-002 | P0 | Scénarios commission E2E non prouvés |

## Verdict

Socle commission **MVP**. Incentive enterprise **non certifié**.
