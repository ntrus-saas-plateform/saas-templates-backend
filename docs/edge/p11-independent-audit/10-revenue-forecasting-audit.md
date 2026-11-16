# 10 — Audit forecasting revenu (P11)

| Champ | Valeur |
|-------|--------|
| Domain | `forecast-calculator.ts` |
| API | `POST edge/revenue/forecasts`, `.../scenarios` |
| Permission | `platform:revenue:forecast` |
| Verdict | Helper tendance **minimal** ; suite modèles **absente** |

## Calculateur (E2)

`historicalTrendForecast` :

- < 2 points finis → `dataQuality: UNAVAILABLE`
- Sinon tendance linéaire `ESTIMATED`
- Specs : `forecast-calculator.spec.ts`

## Persistance

Tables 122 : `edge_p11_revenue_forecasts`, `_scenarios`, `_snapshots`.

## Console

Onglet Forecasts présent (`edge-revenue-module.tsx` permission `platform:revenue:forecast`) — surface MVP, pas suite scénarios enterprise.

## Gaps

| ID | Sévérité | Gap |
|----|----------|-----|
| F-P11-022 | P2 | Pas de modèles pipeline/bookings/commit/best-case complets mandatés |
| F-P11-002 | P0 | Scénarios forecasting E2E non prouvés dans pack 1–45 |
| F-P11-007 | P1 | Pas de FX dans forecasts multi-devises |

## Verdict

Forecasting = **MVP ESTIMATED/UNAVAILABLE honest**. **FAIL** certification forecasting enterprise.
