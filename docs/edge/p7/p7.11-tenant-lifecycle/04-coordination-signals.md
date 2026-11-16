# P7.11 — Coordination Signals

## Model

Required coordination **writes evidence** and **PASSES** when recording intent locally in `metadata.coordination.*` **without** calling foreign mutators that need separate workflows.

| Domain key | Values (examples) | Meaning |
|------------|-------------------|---------|
| `experience` | `REQUESTED` / `RESUME_REQUESTED` | Soft deactivate / resume signal |
| `infra` | `REQUESTED` / `RESUME_REQUESTED` | Quiesce / resume signal |
| `product_control` | `REQUESTED` / `RESUME_REQUESTED` | Suspend / resume signal |

Evidence payload includes `coordination: 'SIGNAL'`, `foreignPortsInvoked: false`.

## Why not call foreign ports

Experience / infra / product-control mutations are owned by P7.6–P7.9 workflows. P7.11 records a **coordination signal** so operators / later orchestrators can launch those workflows explicitly. This avoids inventing success when foreign ports are absent and avoids dual-ownership of destructive mutators.

## Destructive path

On deprovision (`operation=DEPROVISION` / `destructive=true`), destructive coords require dual flags; otherwise return `WAITING_APPROVAL`.
