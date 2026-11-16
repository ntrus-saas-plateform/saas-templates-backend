# P7.8 — Operations Runbook

## Prerequisites

1. Migration **103** applied on control-plane DB.
2. P7.4 workers running with configuration handlers registered.
3. P7.1 authorization rows valid for target tenants.
4. Edge admin has appropriate `platform:configuration:*` / `platform:entitlement:*` permissions.

## Day-2 flows

### Publish a new baseline

1. Create/activate schema.
2. Create template draft → publish.
3. Create bundle referencing template versions → publish.
4. Assign to tenant with `provisioningRequestId` + granted entitlements.
5. Deploy from console or API; watch workflow + runs/evidence.

### Drift detected

1. Open assignment → check `driftStatus` and entitlement version.
2. Run **Reconcile entitlements**.
3. If config checksum mismatch persists, redeploy or rollback after confirming commercial state.

### Emergency rollback

1. Confirm entitlements are still granted (not revoked).
2. `POST …/assignments/:id/rollback` with reason.
3. Verify assignment status `ROLLED_BACK` / run outcome; then reconcile.

## Monitoring

- Workflow instances `workflow_type` starting with `configuration.`
- Failed deployment runs (`outcome=FAILED`) and evidence error codes.
- Audit events `p7.configuration.*`

## Do / Don't

| Do | Don't |
|----|-------|
| Use vault refs for secrets | Paste passwords into JSON payloads |
| Revalidate via P7.1 before mutative ops | Bypass workflows with direct SQL updates |
| Confirm deploy/rollback in console | Expand entitlements in desiredConfig |
