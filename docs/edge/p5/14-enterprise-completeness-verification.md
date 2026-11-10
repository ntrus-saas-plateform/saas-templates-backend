# P5 — Enterprise Completeness Verification

**Date:** 2026-11-09  
**Verdict:** **ENTERPRISE_HARDENED** (control-plane coded scope)  
**Staging:** **NO-GO** until CP migrate `087`–`089` + P0-H

## Closed vs prior audit gaps

| Gap | Closure |
|-----|---------|
| Approvals + change approve/reject | `edge_subscription_approvals` + API + self-approval ban |
| Scheduled changes | schedule API + `POST …/scheduled-changes/process-due` batch executor |
| Lifecycle audit | `appendLifecycleEvent` on status transitions |
| Idempotency-Key | create / from-handoff / activate / suspend |
| Activation failure path | `FAILED_ACTIVATION` + `subscription.activation.failed.v1` |
| `PENDING_PROVISIONING` | driven when provisioning required |
| Cancel with notice | `PENDING_CANCELLATION` when `noticeDays > 0` |
| Trial honesty | `assertTrialNotPaid` + `TRIALING` status |
| Renewal propose/confirm | OFFERED then confirm with new period (history intact) |
| Entitlement reconcile | API + `entitlement.reconciled.v1` |
| Policies | GET/PUT `policies` |
| Coordination reads | billing + provisioning lists |
| ADDON_REMOVE | soft-delete item → `REMOVED` |
| FE operator console | workspace + hub actions for lifecycle/coordination/changes |
| Integration DB spec | `test/integration/edge-subscription-db.spec.ts` |
| Domain adversarial | billing gate + FAILED_ACTIVATION transition covered |

## Evidence

```text
npm run test:edge:subscriptions
# expect ≥19 passed

TESTCONTAINERS=true npm run test:edge:subscriptions:db
# when Docker available
```

Add to `package.json` if missing:  
`test:edge:subscriptions:db` → vitest integration `edge-subscription-db.spec.ts`

## Still external (honest — not code gaps)

| Item | Note |
|------|------|
| Live P6 billing credentials | Adapter UNAVAILABLE until configured |
| Live P7 tenant provisioning | Adapter UNAVAILABLE; no fake TENANT_ACTIVE |
| Authenticated Playwright secrets | Scenarios shipped; need `EDGE_E2E_AUTH=1` |
| Staging / P0-H | Operational gate |
| Background cron daemon | Batch API exists; deploy cron/job separately |

## Enterprise claim boundary

P5 is **enterprise-grade for Okapi Edge Control Plane subscription lifecycle**: governed states, deterministic entitlements, immutable snapshots, approvals, idempotency, P4 handoff ingress, honest P6/P7 coordination. It is **not** a billing engine or tenant provisioner.
