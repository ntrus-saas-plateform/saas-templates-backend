# P7.4 — Domain model

Durable workflow SoT: `src/modules/edge/domain/workflow/` + migration `099`.

## Aggregates

Definitions (+ immutable versions), instances, steps (lease/fencing), attempts, checkpoints, compensations, human tasks, history, dead letters, worker registry.

## Status vocabularies

- Definition: `DRAFT|VALIDATED|PUBLISHED|DEPRECATED|RETIRED`
- Instance / step / task: per mandate §5 (see `workflow.types.ts`)
- Saga policies: `CONTINUE|RETRY|COMPENSATE|PAUSE_FOR_REVIEW|FAIL_WITHOUT_COMPENSATION`

## Ports

`WorkflowAuthorizationPort`, `WorkflowPlacementPort` (COMMITTED only), `WorkflowRepositoryPort` (`claimStepForUpdateSkipLocked`, fencing complete), `WorkflowHandlerRegistryPort` + `UnavailableProvisioningHandler`.
