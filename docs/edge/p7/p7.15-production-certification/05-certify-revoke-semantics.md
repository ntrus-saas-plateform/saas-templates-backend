# P7.15 — Certify & Revoke Semantics

## Certify

1. Package must be `READY` (or retry path from `FAILED` after evidence fixed + re-assemble).
2. `canCertify` / `evaluateCertificationGates` fail-closed on required `MISSING`/`FAILED`.
3. Workflow `p715.certification.certify` → `apply_certify` sets `CERTIFIED` + `certifiedAt`.

## Revoke

1. Package must be `CERTIFIED`.
2. Workflow `p715.certification.revoke` → `apply_revoke` via `applyRevokeClearance`.
3. `certifiedAt` cleared; status `REVOKED`.
