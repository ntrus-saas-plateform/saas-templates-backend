# 11 — Contracted ≠ invoiced ≠ collected

| Concept | Owner | P11 metric / view |
|---------|-------|-------------------|
| Contracted / recurring commitment | P5 subscriptions | MRR_* movements (may include unpaid recurring) |
| Invoiced | P6 issued invoices | `INVOICED_REVENUE` |
| Collected | P6 succeeded payments | `COLLECTED_REVENUE` — never unpaid |
| Receivables | P6 AR open | `RECEIVABLES` |

## Forbidden collapses

- Do not treat MRR as cash collected
- Do not treat invoiced as collected
- Do not seed fake collected amounts as MEASURED production truth
