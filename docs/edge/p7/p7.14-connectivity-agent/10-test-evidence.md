# P7.14 — Test Evidence

Focused suites (see acceptance report for executed counts):

| Suite | Focus |
|-------|--------|
| `connectivity-agent-policy.spec.ts` | outbound_only, vault key, nonce anti-replay, revoke |
| `connectivity-agent.controller.auth.spec.ts` | RBAC metadata per endpoint |
| FE `edge-agents-module.test.tsx` | forbidden / list / detail PENDING+outbound_only |

Also covered by backend `tsc --noEmit` and frontend vitest for `components/edge/agents`.
