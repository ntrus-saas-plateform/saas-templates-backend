# P7.10 — Activation Record (SoT)

## Scope

The **Activation Record** is the **source of truth for technical ACTIVE**. When `activation_status = ACTIVE`, the tenant×product has passed the technical activation gate. This is distinct from:

- Commercial `Subscription` status / `ACTIVE` (P5 / commercial lifecycle)
- P1 commercial readiness
- P6 payment activation

## Data model

`ActivationRecord` (`edge_p7_activation_records`):

| Field | Notes |
|-------|-------|
| `tenantId` / `productId` | Scope of technical activation |
| `subscriptionId` / `accountId` | Optional commercial linkage for P5 signal only |
| `provisioningRequestId` | P7.1 request used for fail-closed revalidation |
| `authorizationRowId` / `authorizationVersion` | Bound P7.1 identity (required columns) |
| `readinessEvaluationId` | Bound evaluation that must be READY before activate |
| `activationStatus` | Technical lifecycle (SoT) |
| `activatedAt` | Set when record becomes technical ACTIVE |
| `p5SignalEmittedAt` / `p5SignalEventId` | Provisioning-completed signal metadata |
| `failureCode` / `failureMessage` | Last gate failure |

Partial unique index: at most one active-path record per `(tenant_id, product_id)` while status is `PENDING` | `EVALUATING` | `READY_FOR_ACTIVATION` | `ACTIVATING` | `ACTIVE`.

## Create

`CreateActivationRecordUseCase`:

1. Revalidate P7.1 via `provisioningRequestId` (fail-closed).
2. Optionally bind an existing readiness evaluation id.
3. Persist `PENDING` — **does not activate**.
4. Audit `p7.activation.record.created`.

## Technical ACTIVE

Only handler `activation.mark_active` (inside `p710.activation.activate`) sets `activationStatus=ACTIVE` and `activatedAt`, after:

1. Fail-closed P7.1 revalidation
2. Bound evaluation still `READY`
3. Lease fencing when lease port wired

Compensation **must not** silently mark ACTIVE.

## P5 signal (not commercial ACTIVE)

Handler `activation.emit_provisioning_completed`:

1. If no `subscriptionId` → evidence `SKIPPED` (`NO_SUBSCRIPTION_ID`).
2. Else set `provisioningConfirmed: true` on the subscription row **only**.
3. Enqueue outbox event `subscription.provisioning.completed.v1`.
4. Record `p5SignalEmittedAt` / `p5SignalEventId`.

Evidence explicitly records `commercialStatusUntouched: true`. The package **does not** set commercial `Subscription.ACTIVE` alone.

## Hard rules

- Activation Record ACTIVE ≠ Subscription ACTIVE.
- No P6 payment path activates technical records.
- No invent ACTIVE client-side in the console (`types/edge-activation.ts` restates the boundary).
