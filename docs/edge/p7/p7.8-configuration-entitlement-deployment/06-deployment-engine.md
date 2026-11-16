# P7.8 — Deployment Engine

## Entry points

| HTTP | Permission | Workflow |
|------|------------|----------|
| `POST /edge/configuration/assignments/:id/deploy` | `platform:configuration:deploy` | `p78.configuration.deploy` |
| `POST /edge/configuration/assignments/:id/rollback` | `platform:configuration:rollback` | `p78.configuration.rollback` |
| `POST /edge/entitlements/assignments/:id/reconcile` | `platform:entitlement:reconcile` | `p78.configuration.reconcile` |

Each request carries actor, correlation id, and idempotency key. Duplicate keys return the existing workflow (idempotent replay).

## Deploy steps (handlers)

1. `configuration.validate_bundle` — published bundle, schema validation, checksum, no plaintext secrets.
2. `configuration.deploy_bundle` — apply desired → applied; update assignment status.
3. `configuration.apply_entitlements` — upsert entitlement deployment from desired/granted maps.
4. `configuration.verify_deployment` — checksum / status verification; durable evidence.

Compensation on deploy failure routes through `configuration.rollback_bundle`.

## Live executor

`live-configuration.executor.ts` bridges P7.4 worker invocations to the configuration repository. All mutations require a valid workflow lease/fencing context from P7.4.

## Runs & evidence

Every attempt creates a `ConfigurationDeploymentRun` (`DEPLOY` / `ROLLBACK` / `RECONCILE`, …) with outcome and observed state. Step evidence is append-only and redacted.
