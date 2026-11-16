# P7.10 — Architecture

## Purpose

P7.10 is the **technical readiness & activation gate**. It aggregates prior-phase provisioning evidence (P7.1 auth, P7.5–P7.9) into a readiness evaluation, then gates **technical** activation via an **Activation Record**. The Activation Record is the source of truth for technical `ACTIVE`. This package does **not** set commercial `Subscription.ACTIVE`, does **not** run P6 payment activation, and does **not** treat P1 commercial product readiness as a technical gate.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Tenant readiness evaluations + required checks | P1 commercial readiness (`/edge/readiness`) |
| Activation Record as SoT for technical ACTIVE | Setting commercial `Subscription.ACTIVE` alone |
| Fail-closed P7.1 revalidation (+ O3 trust material) | Best-effort activate when trust material missing |
| Workflows `p710.readiness.evaluate` / `p710.activation.activate` | Mutative activate via HTTP-only side effects |
| Emit `provisioningConfirmed` + `subscription.provisioning.completed.v1` | P6 payment / commercial activation paths |
| Runs + evidence + history | Expanding P5 entitlements |

## Distinct from P1 commercial readiness

| Surface | Meaning |
|---------|---------|
| `/edge/readiness` (P1) | Commercial / product portfolio readiness board |
| `/edge/provisioning/readiness` (P7.10) | Technical provisioning readiness & activation gate |
| API `/edge/activation/*` | Technical evaluations + activation records |

Do **not** overload `/edge/readiness` for technical activation.

## Layering

```
Edge Console (/edge/provisioning/readiness) / API client
  → EdgeActivationController (RBAC platform:activation:*)
    → Use cases (create evaluation / record, launch evaluate / activate)
      → ActivationRepositoryPort (Postgres, migration 105)
      → P7.4 workflow engine (definitions p710.*)
        → LiveActivationExecutor (handlers readiness.* / activation.*)
          → prior-phase ports (infra, Keycloak, config, experience, product control)
          → optional Subscription port: provisioningConfirmed only
      → P7.1 authorization revalidation (fail-closed; TRUST_MATERIAL_MISSING denies)
```

## Hard dependencies

- **P7.1** — bound authorization must revalidate before create / evaluate / activate and again before every handler mutation (fail-closed). Missing row/version → `TRUST_MATERIAL_MISSING` (O3: production G1/P5 trust material must exist; absence never best-effort activates).
- **P7.4** — mutative evaluate / activate only via durable workflows; handlers require a live executor (no simulated success).
- **P7.5–P7.9** — readiness checks read prior-phase evidence; missing ports fail required checks (fail-closed).
- **P5** — on successful technical activation with a bound subscription, emit provisioning-completed signal only; commercial ACTIVE remains P5’s concern.

## Workflow definitions

| Code | Intent |
|------|--------|
| `p710.readiness.evaluate` | validate_auth → parallel prior-phase checks → aggregate READY / NOT_READY |
| `p710.activation.activate` | revalidate_auth → require READY evidence → mark_active → emit_provisioning_completed → verify |

Compensation never silently marks ACTIVE — handlers suspend compensation for operator approval (`platform:activation:activate`).

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md` (addendum: migration **105**).
