# P7.8 — Security Review

## AuthZ matrix

| Permission | Capabilities |
|------------|--------------|
| `platform:configuration:read` | List/get schemas, templates, bundles, assignments |
| `platform:configuration:manage` | Create/publish schemas, templates, bundles |
| `platform:configuration:deploy` | Assign + deploy |
| `platform:configuration:rollback` | Rollback |
| `platform:configuration:history:read` | Runs + evidence |
| `platform:entitlement:read` | Entitlement deployments |
| `platform:entitlement:reconcile` | Reconcile workflow |

Controller auth coverage: `configuration.controller.auth.spec.ts`.

## Fail-closed controls

- P7.1 revalidation on assign, deploy, rollback, reconcile.
- No entitlement expansion beyond P5 snapshot.
- Secrets: schema engine + redaction for events/UI.
- Mutations only via P7.4 handlers with lease/fencing.
- Durable audit required for configuration mutations (outbox + audit ports).

## Threat notes

| Threat | Mitigation |
|--------|------------|
| Privilege escalation via config | Expansion check + P7.1 |
| Secret exfiltration via API/UI | Vault refs only; console redaction |
| Replay / duplicate deploy | Idempotency keys |
| Stale worker mutation | P7.4 lease fencing |
| Unauthorized history read | Separate history permission |

## Residual risks

- Push to remote may fail with **HTTP 403** (repo permissions) — local commits only until fixed.
- Live remote provider apply beyond local registry remains limited to what the live executor implements.
