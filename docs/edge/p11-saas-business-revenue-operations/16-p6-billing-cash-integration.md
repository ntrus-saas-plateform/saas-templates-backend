# 16 — P6 billing & cash integration

## Direction

```
P6 invoice/payment refs --provenance--> INVOICED / COLLECTED / RECEIVABLES snapshots
P11 --X--> never creates invoices, payment intents, or stores credentials
```

**Vague 2:** executable recognition via `ComputeCashRevenueUseCase` + `cash-revenue-calculator` (read-only P6 export lists → INVOICED/COLLECTED/RECEIVABLES). Manual snapshots of those codes require `sourceProvenance.source=engine`. See [`27-vague2-cash-engine.md`](./27-vague2-cash-engine.md).

Assurance detectors consume evidence structs; they do not call P6 mutators.
