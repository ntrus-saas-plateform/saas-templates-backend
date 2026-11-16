# 06 — Retention (GRR / NRR) & cohorts

## Definitions

### GRR (Gross Revenue Retention)

```
endingRetained = startingMrr − contraction − churned
grrPct = endingRetained / startingMrr
```

**Expansion and reactivation are excluded.** Missing starting/contraction/churned → UNAVAILABLE (not 0% or 100%).

### NRR (Net Revenue Retention)

```
ending = startingMrr + expansion − contraction − churned [+ reactivation]
nrrPct = ending / startingMrr
```

Reactivation defaults to included in NRR (`includeReactivationInNrr=true`); never invent components.

## Implementation

- Pure calculator: `retention-calculator.ts`
- Snapshots: `edge_p11_retention_snapshots` + cohorts table
- Overview reads **stored** GRR/NRR snapshots only

## Console

Retention tab shows GRR/NRR with dataQuality badges; UNAVAILABLE → EdgeEmptyState.
