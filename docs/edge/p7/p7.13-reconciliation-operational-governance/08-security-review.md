# P7.13 — Security Review

## Permissions

| Permission | Use |
|------------|-----|
| `platform:reconciliation:read` | List policies/runs/findings/waivers |
| `platform:reconciliation:run` | Create run + launch observe |
| `platform:reconciliation:remediate` | Launch remediate |
| `platform:reconciliation:approve` | Policy create, waiver, approve remediation |
| `platform:reconciliation:quarantine` | Quarantine findings |
| `platform:reconciliation:history:read` | Evidence / history |

Roles: `EDGE_PLATFORM_SUPER_ADMIN` (all); `EDGE_PLATFORM_OPERATOR` (read/run/history).

## Trust

- Bound `provisioningRequestId` ⇒ P7.1 revalidation mandatory (fail-closed).
- Approval cannot bypass auth (`canApproveRemediation` requires revalidated).
- Durable audit on all mutations; evidence on all handler outcomes.

## Authz tests

`reconciliation.controller.auth.spec.ts` asserts every endpoint permission metadata.
