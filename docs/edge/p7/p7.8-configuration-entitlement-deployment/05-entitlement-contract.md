# P7.8 — Entitlement Contract

## Authority

**P5** is the commercial entitlement authority. P7.8 deploys a **subset or equal** projection of the granted snapshot; it never invents rights.

## Snapshot inputs

At assignment:

- `grantedEntitlements` — `{ capabilities, featureFlags, quotas, limits }`
- `entitlementSnapshotRef` / `entitlementVersion` — opaque P5 identity
- Desired config may embed an `entitlements` object that is checked for expansion

## Expansion rejection

If desired entitlements expand beyond granted (extra capability keys, elevated quotas/limits, newly true flags), assign fails with `ENTITLEMENT_EXPANSION`.

## Deployment record

`EntitlementDeploymentRecord` stores:

- Digested payload (`payloadDigest`)
- Capabilities / flags / quotas / limits maps
- `deploymentStatus`, `source`, `workflowId`, evidence bag
- `deployedAt` / `revokedAt`

## Reconcile

`POST …/entitlements/assignments/:id/reconcile` launches `p78.configuration.reconcile` after P7.1 revalidation. Drift is written onto the assignment (`driftStatus`) and evidence rows.

## Rollback vs revocation

Rollback that would restore previously revoked entitlements is rejected (`ROLLBACK_FORBIDDEN` / entitlement revoked). Suspended/revoked commercial rights win over “restore previous technical config.”
