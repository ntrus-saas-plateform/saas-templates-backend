# 05 — MRR / ARR & revenue calculations

## Source of truth for movement math

Pure functions in `mrr-calculator.ts`. No DB side effects. Use case `ComputeMrrMovementUseCase` may optionally persist snapshots when definitions are PUBLISHED.

## Normalization

| Billing period | Monthly MRR |
|----------------|-------------|
| `MONTHLY` | amount |
| `ANNUAL` / `YEARLY` | amount **/ 12** |
| `QUARTERLY` | amount / 3 |
| `WEEKLY` | amount × (52/12) |
| `OTHER` / unknown | **skipped** (NaN) — no silent assumption |

## Free trials

Default `excludeFreeTrials=true`. Trial lines are counted in `skippedLineCount`, not in MRR buckets.

## Collected vs recurring

- MRR classification may include unpaid recurring lines (commitment view).
- **`COLLECTED_REVENUE` never counts unpaid / pending** — only succeeded P6 payments (`isCollectedEligible`).
- Empty input lines ⇒ all buckets `UNAVAILABLE` (not measured zeros).

## Net new & ARR

```
MRR_NET_NEW = NEW + EXPANSION + REACTIVATION − CONTRACTION − CHURNED
ARR_ENDING  = MRR_ENDING × 12
```

If any net-new component is `UNAVAILABLE`, net new is `UNAVAILABLE`.

## Overview API

`GET edge/revenue/overview` reads **stored snapshots only**. Missing codes return `dataQuality: UNAVAILABLE` with an explicit note — never invents production financial truth.
