# P7.8 — Architecture

## Purpose

P7.8 deploys **versioned technical configuration** and **P5-granted entitlements** to tenants. It is not a commercial authority: P5 owns entitlement grants; P7.8 applies them without expansion.

## Boundaries

| In scope | Out of scope |
|----------|--------------|
| Configuration schemas, templates, bundles | Product catalog / commercial pricing |
| Tenant assignments + deploy/rollback | Tenant business IAM / end-user management |
| Entitlement deployment from P5 snapshots | Expanding capabilities beyond granted snapshot |
| Drift detection / reconcile | Direct mutation of remote systems outside P7.4 |
| Evidence + deployment history | Plaintext secrets in configs or events |

## Layering

```
Edge Console (frontend)
  → EdgeConfigurationController (RBAC)
    → Use cases (registry + assign/deploy/rollback/reconcile)
      → ConfigurationRepositoryPort (Postgres, migration 103)
      → P7.4 workflow engine (definitions p78.configuration.*)
        → LiveConfigurationExecutor (handlers)
          → schema engine + local apply + entitlement records
      → P7.1 authorization revalidation (fail-closed)
```

## Hard dependencies

- **P7.1** — provisioning authorization must be valid before assign / deploy / reconcile / rollback that restores rights.
- **P7.4** — all mutative deploy/rollback/reconcile paths launch durable workflows; no silent side-effects from the HTTP layer alone.
- **P5** — entitlement snapshot is the ceiling; desired entitlements that expand grants are rejected (`ENTITLEMENT_EXPANSION`).

## Workflow definitions

| Code | Intent |
|------|--------|
| `p78.configuration.deploy` | validate → deploy bundle → apply entitlements → verify |
| `p78.configuration.rollback` | rollback bundle → reconcile entitlements |
| `p78.configuration.reconcile` | compare applied vs desired; record drift |

## Secrets

Configs may only carry vault references (`sec_*` / `vault:`). Schema engine rejects plaintext secret-like keys. Console redacts any residual secret-shaped fields for display.

## Related audit

Prior-phase readiness: `docs/edge/p7/p7-completion/00-prior-phases-integration-audit.md`.
