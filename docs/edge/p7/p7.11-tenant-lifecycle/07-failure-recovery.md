# P7.11 — Failure & Recovery

| Failure | Behavior |
|---------|----------|
| No live executor | Handler `FAILED` / `PROVIDER_UNAVAILABLE` (fail-closed) |
| Lease invalid | Evidence + `AUTHORIZATION_FAILED` |
| P7.1 deny / trust missing | Evidence + deny; may stamp failure on record |
| Activation not ACTIVE | `ACTIVATION_NOT_ACTIVE` |
| Deprovision without flags | `WAITING_APPROVAL` (mark_deprovisioned / destructive coords) |
| Missing export evidence | `EXPORT_EVIDENCE_REQUIRED` |
| Forbidden transition | `LIFECYCLE_FORBIDDEN` |
| Compensation | Always `WAITING_APPROVAL` — never silent flip |

Operator recovery: fix trust material / flags / export evidence, then relaunch workflow with new idempotency key. Migrate/recover workflows are reserved for later packages.
