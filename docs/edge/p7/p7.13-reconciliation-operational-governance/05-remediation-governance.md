# P7.13 — Remediation Governance

## Mutative path

All remediations launch via **P7.4** workflow `p713.reconciliation.remediate`. Controllers never mutate finding status directly except quarantine/waiver create (audited).

## Approval

- Auto path: only when `canAutoRemediate` allows.
- Else remediation stays `WAITING_APPROVAL` until `ApproveReconciliationRemediationUseCase` (P7.1 revalidated).
- Reject marks remediation `REJECTED` without execute.

## Execute semantics (evidence-only)

`reconciliation.execute_remediation`:

1. Require approval **or** auto eligibility.
2. Mark remediation `RUNNING` → finding `REMEDIATING`.
3. Persist evidence `{ mode: 'EVIDENCE_ONLY_LOCAL_STATUS', foreignDestructorsInvoked: false }`.
4. Mark remediation `SUCCEEDED`, finding `REMEDIATED`.
5. **Do not** call foreign destructors / provider delete APIs.

## No blind deletes

`UNEXPECTED` resources never auto-delete. Plans use `REQUIRE_APPROVAL_NO_DELETE`.
