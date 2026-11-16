# P7.12 — Security Review

## Controls

1. **RBAC** — `platform:onboarding:*` permissions (migration 107); SUPER_ADMIN all; OPERATOR read/history/approve.
2. **P7.1 fail-closed** — every mutative use-case and every live handler revalidates bound authorization.
3. **Human approval cannot bypass auth** — `canDecideTask` requires `authorizationRevalidated`; executor `apply_task_decision` gates via `gateMutation` and maps deny → `HUMAN_APPROVAL_CANNOT_BYPASS_AUTH`.
4. **Lease fencing** — when lease port present, invalid fencing → deny.
5. **No CRM / invites / Subscription.ACTIVE** — domain + executor comments + evidence notes; Business Backend remains SoT for memberships.
6. **Close gate** — required steps must be PASSED; human APPROVE alone does not close.

## Authz tests

`onboarding.controller.auth.spec.ts` asserts permission metadata on every endpoint (not public).
