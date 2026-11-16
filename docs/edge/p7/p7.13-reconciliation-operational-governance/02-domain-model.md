# P7.13 — Domain Model

## Aggregates / records

| Record | Role |
|--------|------|
| `ReconciliationPolicy` | Scope, `autoRemediate`, `requireApproval`, rules |
| `ReconciliationRun` | Observation campaign; desired/observed snapshots; driftCount |
| `ReconciliationFinding` | Classified observation (`DRIFT`/`MISSING`/`UNEXPECTED`/`UNKNOWN`/`CONFLICT`) |
| `ReconciliationRemediation` | Plan + status; `reversible`; evidence |
| `ReconciliationWaiver` | Time-bounded exception; expired = invalid |
| `ReconciliationEvidence` | Durable operation outcomes |

## ObservationClass (critical)

| Class | Meaning |
|-------|---------|
| `DRIFT` | Desired ≠ observed |
| `MISSING` | Desired absent in observed (only when reachable) |
| `UNEXPECTED` | Observed without desired — **no auto-delete** |
| `UNKNOWN` | Provider unreachable/timeout — **never treat as deleted** |
| `CONFLICT` | Conflicting authoritative states |

## Status enums

- Run: `PENDING` → `RUNNING` → `SUCCEEDED` / `PARTIAL` / `FAILED` / `WAITING_APPROVAL`
- Finding: `OPEN` → `REMEDIATING` → `REMEDIATED` | `QUARANTINED` | `WAIVED`
- Remediation: `PENDING` / `WAITING_APPROVAL` → `APPROVED` → `RUNNING` → `SUCCEEDED`

## Handler keys

`reconciliation.revalidate_auth`, `collect_desired`, `collect_observed`, `classify_findings`, `apply_waivers`, `plan_remediation`, `execute_remediation`, `quarantine`, `verify`.
