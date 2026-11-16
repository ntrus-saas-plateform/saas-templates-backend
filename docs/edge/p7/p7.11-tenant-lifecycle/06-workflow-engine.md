# P7.11 — Workflow Engine Integration

## Definitions

Ensured idempotently by `ensureLifecycleDefinition` → PUBLISHED.

- `p711.lifecycle.suspend`
- `p711.lifecycle.resume`
- `p711.lifecycle.deprovision`

## Live executor

`LIFECYCLE_LIVE_EXECUTOR` (7th executor in `WorkflowHandlerRegistry`) → `createLiveLifecycleExecutor`.

Every mutation: `gateMutation` = lease validation (when lease port present) + P7.1 revalidation.

## Compensation

All handlers compensate to `WAITING_APPROVAL`. Destructive keys require `platform:lifecycle:deprovision`.
