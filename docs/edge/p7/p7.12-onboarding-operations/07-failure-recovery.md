# P7.12 — Failure & Recovery

| Failure | Behavior |
|---------|----------|
| Missing / invalid P7.1 trust | Handler FAILED `AUTHORIZATION_FAILED`; journey may record failureCode |
| Activation not ACTIVE | `ACTIVATION_NOT_ACTIVE` fail-closed |
| Advance while WAITING_APPROVAL | Use-case guard rejects (`JOURNEY_FORBIDDEN`) |
| Human decide without auth | `HUMAN_APPROVAL_CANNOT_BYPASS_AUTH` |
| Close with incomplete required steps | `STEP_NOT_READY` |
| Optimistic lock | `CONFLICT` |
| Missing live executor | `PROVIDER_UNAVAILABLE` (no simulated success) |
| Human REJECT | Step FAILED; journey FAILED; operator may retry advance after remediation |

Idempotency: workflow create uses idempotency keys; materialize_steps is idempotent when steps exist.
