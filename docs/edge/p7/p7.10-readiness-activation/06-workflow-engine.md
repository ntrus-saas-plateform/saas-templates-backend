# P7.10 — Workflow Engine

## Entry points

| HTTP | Permission | Workflow |
|------|------------|----------|
| `POST /edge/activation/evaluations/:id/evaluate` | `platform:activation:evaluate` | `p710.readiness.evaluate` |
| `POST /edge/activation/records/:id/evaluate` | `platform:activation:evaluate` | `p710.readiness.evaluate` (bound evaluation) |
| `POST /edge/activation/records/:id/activate` | `platform:activation:activate` | `p710.activation.activate` |

Each request carries actor, correlation id, and idempotency key. Duplicate keys return the existing workflow (idempotent replay). Create evaluation / create record persist rows only; evaluate / activate launch P7.4.

## Evaluate steps (`readiness.*`)

1. `readiness.validate_auth` — P7.1 revalidate; write `auth.p71_revalidated`.
2. `readiness.check_infra` — READY resources or committed/validated plans.
3. `readiness.check_keycloak` — READY/ACTIVE/VERIFIED topology.
4. `readiness.check_configuration` — DEPLOYED configuration assignment.
5. `readiness.check_entitlements` — DEPLOYED entitlement deployment.
6. `readiness.check_experience` — READY experience assignment.
7. `readiness.check_product_control` — ACTIVE product-control endpoint.
8. `readiness.aggregate` — score + READY/NOT_READY; may set record `READY_FOR_ACTIVATION`.

Parallelism: checks 2–7 depend on `validate_auth`; `aggregate` depends on all checks.

## Activate steps (`activation.*`)

1. `activation.revalidate_auth` — fail-closed P7.1; mark `ACTIVATING` (or `FAILED` on deny).
2. `activation.require_ready_evidence` — bound evaluation must be `READY`.
3. `activation.mark_active` — set Activation Record technical `ACTIVE` (SoT).
4. `activation.emit_provisioning_completed` — `provisioningConfirmed` + outbox `subscription.provisioning.completed.v1` (skip if no subscription).
5. `activation.verify` — record still ACTIVE; P5 signal present or intentional SKIPPED.

## Handler keys

```
readiness.validate_auth
readiness.check_infra
readiness.check_keycloak
readiness.check_configuration
readiness.check_entitlements
readiness.check_experience
readiness.check_product_control
readiness.aggregate

activation.revalidate_auth
activation.require_ready_evidence
activation.mark_active
activation.emit_provisioning_completed
activation.verify
```

Registered via `registerActivationHandlers` → `ActivationProvisioningHandler` (version `1.0.0-p710`).

## Live executor

`live-activation.executor.ts` bridges P7.4 worker invocations to the activation repository and prior-phase ports. Mutations are gated by:

- Optional `WorkflowLeasePort` fencing when wired.
- Fail-closed `revalidateBoundAuthorization` before every handler mutation (`TRUST_MATERIAL_MISSING` / deny).
- Durable evidence (failure to persist evidence fails the step).

Handlers without a live executor return `PROVIDER_UNAVAILABLE` (no simulated success).

## Runs & evidence

Activation runs record operations `EVALUATE` | `ACTIVATE` | `VERIFY` | `BLOCK` | `SUPERSEDE`. Step evidence is append-only. Workflow types: `readiness.evaluate` / `activation.activate`.
