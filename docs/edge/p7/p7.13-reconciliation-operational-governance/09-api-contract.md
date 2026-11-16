# P7.13 — API Contract

Base: Edge authenticated routes under `/edge/reconciliation/*`.

| Method | Path | Permission |
|--------|------|------------|
| GET | `/edge/reconciliation/policies` | read |
| POST | `/edge/reconciliation/policies` | approve |
| GET | `/edge/reconciliation/runs` | read |
| GET | `/edge/reconciliation/runs/:id` | read (detail + findings + remediations + evidence) |
| POST | `/edge/reconciliation/runs` | run |
| POST | `/edge/reconciliation/runs/:id/observe` | run → `p713.reconciliation.observe` |
| POST | `/edge/reconciliation/runs/:id/remediate` | remediate → `p713.reconciliation.remediate` |
| POST | `/edge/reconciliation/runs/:runId/remediations/:remediationId/decide` | approve |
| GET | `/edge/reconciliation/findings` | read |
| POST | `/edge/reconciliation/findings/:id/quarantine` | quarantine |
| GET/POST | `/edge/reconciliation/waivers` | read / approve |
| GET | `/edge/reconciliation/runs/:id/evidence` | history:read |
| GET | `/edge/reconciliation/history` | history:read |

## Observe body highlights

- `desired` / `observed` resource arrays
- `providerUnreachable: true` ⇒ UNKNOWN classification
