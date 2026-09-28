# ERP Reconciliation

## Three-way match (PO / GR / Invoice)

Endpoint: `POST /orchestration/purchasing/three-way-match`  
Permission: `purchasing:three_way`

Pure evaluator: `evaluateThreeWayMatch` in `domain/three-way-match.ts`.

| Code | Meaning |
|------|---------|
| `QUANTITY_VARIANCE` | PO/GR/Invoice quantities diverge beyond tolerance |
| `PRICE_VARIANCE` | PO vs invoice amount diverge |
| `AMOUNT_VARIANCE` | Amount mismatch (PO/invoice or GR/invoice) |
| `MISSING_GR` | No goods receipt quantities/amounts |
| `MISSING_INVOICE` | No supplier invoice figures |
| `MISSING_PO` | No PO figures |

Status outcomes: `MATCHED`, `PARTIALLY_MATCHED`, `MISMATCH`, `ERROR`.

Orchestration stores the match result only; it does not rewrite purchasing documents.

## POS shift close

1. `POST /orchestration/pos/shift-close` — compute `expectedCash = openingBalance + cashSales - refunds`.
2. `POST /orchestration/pos/shift-close/:id/close` — set actual cash; `variance = actual - expected`.
3. Non-zero variance → status `VARIANCE_REVIEW`; else `CLOSED`.

## Saga / process monitor

- Stuck processes: `GET /orchestration/business-processes/stuck?olderThanMinutes=60` (marks idle RUNNING as STUCK).
- Manual intervention: `POST /orchestration/interventions` → event `orchestration.manual_intervention.v1`.
- Integration health: `GET /orchestration/integrations/health` — inventory degraded if ≥5 FAILED sagas in last hour; other systems stub healthy.
- Dead letters: `GET /orchestration/ops/dead-letters` — empty until OutboxStorePort exposes a list API.
