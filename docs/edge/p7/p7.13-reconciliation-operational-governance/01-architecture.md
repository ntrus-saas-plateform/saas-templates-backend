# P7.13 — Architecture

## Purpose

P7.13 is the **reconciliation & operational governance** layer. It owns drift observation, finding classification, remediation plans, waivers/exceptions, quarantine, and evidence. Remediations execute **only** via P7.4. Timeout/unreachable ⇒ `ObservationClass.UNKNOWN` — **never** treated as deleted.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Policy + Run + Finding + Remediation + Waiver + Evidence | Blind deletes / foreign destructors |
| Observe / remediate via P7.4 (`p713.reconciliation.*`) | Treating UNKNOWN as MISSING |
| Auto-remediate only if eligible + policy + reversible | Unsafe auto-remediate |
| Expired waivers invalid | Bypassing P7.1 when `provisioningRequestId` bound |

## Layering

```
Edge Console (/edge/provisioning/reconciliation) / API client
  → EdgeReconciliationController (RBAC platform:reconciliation:*)
    → Use cases (policy/run/observe/remediate/approve/waiver/quarantine)
      → ReconciliationRepositoryPort (Postgres, migration 109)
      → P7.4 workflow engine (definitions p713.reconciliation.*)
        → LiveReconciliationExecutor (handlers reconciliation.*)
          → classify UNKNOWN if providerUnreachable; plan without unsafe auto
          → execute = evidence-only local status (REMEDIATED) — no foreign destructors
      → P7.1 authorization revalidation (fail-closed when provisioningRequestId bound)
```

## Hard dependencies

- **P7.1** — fail-closed when `provisioningRequestId` bound.
- **P7.4** — mutative observe / remediate only via durable workflows; 9th live executor.
- **Migration 109** — note: **108** is reserved by **P8** advanced tenant management.

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md` (addendum: migration **109**).
