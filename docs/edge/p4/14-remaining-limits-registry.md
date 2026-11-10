# P4 — Remaining Limits Registry

| ID | Limit | Severity | Status |
|----|-------|----------|--------|
| L-01 | Live DocuSign/HelloSign credentials | MED | **WIRED** — resolving adapter + DocuSign/HelloSign; UNAVAILABLE without secrets |
| L-02 | Design-studio PDF | LOW | Minimal PDF generator shipped; advanced layout deferred |
| L-03 | Live calendar sync | LOW | **WIRED** — Google/Outlook resolving adapter; UNAVAILABLE without tokens |
| L-04 | Row-level visibility | — | **CLOSED** (grants + assert + search modes) |
| L-05 | Opportunity Workspace FE | — | **CLOSED** (`/edge/sales/opportunities/[id]`) |
| L-06 | Playwright sales suite | MED | **CLOSED** smoke + scenarios A–F (auth gated on `EDGE_E2E_AUTH=1`) |
| L-07 | Staging / P0-H | HIGH | Operational — migrate `081`–`086` + P0-H.8 still required |
| L-08 | Enrichment providers | LOW | Off until configured |
| L-09 | Recognized revenue | N/A | Out of P4 by design |

See [`17-provider-ops-runbook.md`](./17-provider-ops-runbook.md) for env wiring and migrate checks.
