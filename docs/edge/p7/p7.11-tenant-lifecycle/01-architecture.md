# P7.11 — Architecture

## Purpose

P7.11 is the **tenant technical lifecycle** layer post P7.10 activation. It owns suspend / resume / deprovision (and stubs for migrate / recover) for the **technical** runtime experience. It does **not** manage business IAM, does **not** set commercial `Subscription` status alone, and **never** silently deletes.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Lifecycle Record bound to ACTIVE Activation Record | Business IAM / org membership |
| Suspend / resume / deprovision via P7.4 workflows | Setting commercial `Subscription` status alone |
| Fail-closed P7.1 revalidation + lease | Best-effort deprovision without flags |
| Coordination **signals** in metadata + evidence | Invoking foreign mutators that need separate workflows |
| deletion_protection + export evidence + dual flags | Silent delete / DATA_PURGED without retention |

## Layering

```
Edge Console (/edge/provisioning/lifecycle) / API client
  → EdgeLifecycleController (RBAC platform:lifecycle:*)
    → Use cases (create from ACTIVE activation, launch suspend/resume/deprovision)
      → LifecycleRepositoryPort (Postgres, migration 106)
      → P7.4 workflow engine (definitions p711.lifecycle.*)
        → LiveLifecycleExecutor (handlers lifecycle.*)
          → ACTIVATION_REPOSITORY_PORT (require ACTIVE)
          → coordination signals → metadata.coordination.*
      → P7.1 authorization revalidation (fail-closed)
```

## Hard dependencies

- **P7.10** — Lifecycle Record requires Activation Record `ACTIVE`.
- **P7.1** — bound authorization revalidated before create / launch and every handler mutation.
- **P7.4** — mutative suspend / resume / deprovision only via durable workflows; handlers require live executor.
- **O3** — missing trust material remains fail-closed.

## Workflow definitions

| Code | Intent |
|------|--------|
| `p711.lifecycle.suspend` | revalidate → require activation ACTIVE → mark suspending → coord signals → mark suspended → verify |
| `p711.lifecycle.resume` | revalidate → require suspended → mark resuming → coord resume signals → mark active → verify |
| `p711.lifecycle.deprovision` | revalidate → require flags + export evidence → mark deprovisioning → destructive coords → mark deprovisioned → verify |

Destructive `mark_deprovisioned` / destructive coords → `WAITING_APPROVAL` without `authorized && confirmed`. Compensation never silent-deprovisions.

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md` (addendum: migration **106**).
