# P7.10 — Operations Runbook

## Prerequisites

1. Migration **105** applied on control-plane DB.
2. P7.4 workers running with activation handlers registered and live executor wired (prior-phase ports injected).
3. P7.1 authorization rows valid for target tenants (`provisioningRequestId` ready; trust material present — O3 fail-closed).
4. Prior phases P7.5–P7.9 evidence available for the tenant×product (infra, Keycloak, configuration/entitlements, experience, product control).
5. Edge admin has appropriate `platform:activation:*` permissions.

## Day-2 flows

### Technical readiness evaluate

1. Create evaluation with `tenantId`, `productId`, `provisioningRequestId` (`POST /edge/activation/evaluations`).
2. Optionally create an Activation Record bound to that evaluation (`POST /edge/activation/records`).
3. Launch evaluate (`POST …/evaluations/:id/evaluate` or `…/records/:id/evaluate`).
4. Watch workflow `p710.readiness.evaluate` + checks until evaluation `READY` or inspect `blockingCodes`.
5. Console: `/edge/provisioning/readiness` (do not use `/edge/readiness` commercial board).

### Technical activate

1. Confirm evaluation `READY` and Activation Record `READY_FOR_ACTIVATION` (or PENDING with READY evaluation bound).
2. `POST …/records/:id/activate` with a fresh idempotency key.
3. Confirm Activation Record technical `ACTIVE` + evidence for `activation.mark_active`.
4. If subscription bound: confirm `provisioningConfirmed` and outbox `subscription.provisioning.completed.v1` — **not** commercial Subscription ACTIVE alone.
5. If no subscription: confirm emit step SKIPPED with `NO_SUBSCRIPTION_ID`.

### Trust material / O3 issues

1. If activate/evaluate returns `TRUST_MATERIAL_MISSING` or `AUTHORIZATION_FAILED`, restore P7.1 G1/P5 trust material and revalidate — never SQL-force ACTIVE.
2. Re-create or refresh provisioning authorization, then re-run with a new idempotency key.

## Monitoring

- Workflow instances `workflow_type` `readiness.evaluate` / `activation.activate` (definition codes `p710.*`).
- Failed activation runs and evidence error codes (`TRUST_MATERIAL_MISSING`, `READINESS_NOT_READY`, `P5_SIGNAL_FAILED`).
- Audit events `p7.activation.*`

## Do / Don't

| Do | Don't |
|----|-------|
| Use Activation Record as SoT for technical ACTIVE | Set commercial `Subscription.ACTIVE` from this package alone |
| Fail closed on missing trust material (O3) | Best-effort activate when auth row/version missing |
| Drive mutative ops via P7.4 workflows | Bypass with direct SQL status updates |
| Keep `/edge/provisioning/readiness` separate from P1 | Overload `/edge/readiness` for technical activation |
| Treat P6 payment as out of scope | Use payment success as a technical READY substitute |
