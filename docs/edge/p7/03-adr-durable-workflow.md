# ADR-P7-001 — Durable Workflow Engine

**Status:** Proposed (G0)  
**Date:** 2026-11-10  
**Context:** P7 requires multi-step distributed ops with crash recovery, leases, fencing, compensation. Existing `JobSchedulerService` is interval + Redis lock only.

## Decision

**Build an internal durable workflow engine inside Edge** (same Nest app / control-plane DB), not an external Temporal/Cadence dependency for the reference path.

## Rationale

- Reuses Postgres + outbox already certified for P4–P6.
- Keeps evidence, RBAC, and audit in one control plane.
- Avoids new runtime ops surface before P7.15 certification.
- Interfaces (`WorkflowDefinition`, `StepExecutor`, `LeaseManager`) allow later external engine swap if needed.

## Consequences

- Must implement: definitions/versioning, instances, steps, attempts, checkpoints, leases, fencing tokens, compensation, human tasks, recovery workers.
- Workers must be separate from HTTP request lifecycle (dedicated bootstrap similar to billing jobs).
- `JobSchedulerService` may trigger recovery polls only — not execute saga steps inline.

## Alternatives rejected (for now)

| Option | Why not for G0 |
|--------|----------------|
| Temporal | Ops + learning cost; deferred until proven need |
| Pure Redis queues | No durable evidence / fencing story |
| Inline use-case chains | Cannot survive crash mid-step |

## Gate

G4 requires a test workflow surviving full process kill without duplicate external side effects.
