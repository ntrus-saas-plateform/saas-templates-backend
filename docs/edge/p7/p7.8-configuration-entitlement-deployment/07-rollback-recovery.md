# P7.8 — Rollback & Recovery

## Controlled rollback

`RequestConfigurationRollbackUseCase`:

1. Load assignment; reject if missing.
2. Revalidate P7.1 authorization (fail-closed).
3. Reject if entitlements were revoked / would restore illegal rights.
4. Launch `p78.configuration.rollback` with idempotency.
5. Emit audit/outbox event `p7.configuration.rollback.requested`.

## Rollback steps

1. `configuration.rollback_bundle` — restore prior applied config / mark assignment `ROLLED_BACK` or fail with evidence.
2. `configuration.reconcile_entitlements` — align entitlement deployment with post-rollback desired state; update drift.

## Recovery practices

- Prefer **reconcile** when drift is detected without a full rollback.
- Redeploy after fixing schema/payload issues rather than bypassing validation.
- Do not manually edit `applied_config` in SQL; always go through workflows for auditability.
- On `IDEMPOTENT_REPLAY`, inspect existing workflow status before launching a new run.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 403 on deploy/rollback | Missing RBAC permission | Grant deploy/rollback |
| `AUTHORIZATION_FAILED` | P7.1 expired/revoked | Refresh provisioning auth |
| `ROLLBACK_FORBIDDEN` | Entitlement revoked | Fix commercial grant first |
| `CHECKSUM_MISMATCH` | Tampered / partial apply | Reconcile then redeploy |
