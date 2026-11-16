# 05 — Audit revenue intelligence (P11)

| Champ | Valeur |
|-------|--------|
| Périmètre | Overview, snapshots, projection live/stub, provenance |
| Verdict | Intelligence **partielle** ; signaux qualité ambigus |

## Surfaces API (E3)

Controller `revenue-operations.controller.ts` :

- `GET edge/revenue/overview` — snapshots stockés ; UNAVAILABLE si manquant
- `GET edge/revenue/metrics/definitions`
- `POST edge/revenue/metrics/snapshots`
- `POST edge/revenue/mrr/compute`

Overview repository : agrège métriques ; `availability` = `UNAVAILABLE|PARTIAL|AVAILABLE` selon `dataQuality` (`pg-revenue.repository.ts`).

## Projection live — findings critiques

Fichier `live-revenue-projection.adapter.ts` :

```typescript
paymentStatus: 'UNKNOWN',
movementType: activeAtPeriodEnd ? 'ENDING' : 'STARTING',
dataQuality: 'MEASURED',
```

| ID | Sévérité | Observation |
|----|----------|-------------|
| **F-P11-004** | P1 | `dataQuality: MEASURED` alors que `paymentStatus: UNKNOWN` — trompeur pour cash vs contracted |
| **F-P11-005** | P1 | Mouvements limités à STARTING/ENDING — pas NEW/EXPANSION/CONTRACTION/CHURNED dérivés |

Limite liste : `limit: 500` subscriptions ACTIVE — [F-P11-020](./34-findings-and-risk-register.md) P2 (couverture incomplete à l’échelle).

## Stub projection

`stub-revenue-projection.adapter.ts` — retourne vide / stub ; callers doivent traiter empty comme UNAVAILABLE (port documenté). **PASS doctrine E3** ; bascule runtime [F-P11-034] P3.

## Verdict

Revenue intelligence MVP **utilisable pour MRR snapshoté**, **non fiable** comme intelligence cash/mouvements entreprise sans correction F-P11-004/005/001.
