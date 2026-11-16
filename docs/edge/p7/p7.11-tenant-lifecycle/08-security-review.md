# P7.11 — Security Review

| Threat | Mitigation |
|--------|------------|
| Unauthorized suspend/resume/deprovision | RBAC `platform:lifecycle:*` + P7.1 revalidation |
| Silent delete | Never; deprovision flags + export evidence + deletion_protection |
| Best-effort without trust material | Fail-closed `AUTHORIZATION_FAILED` |
| Compensate → deprovisioned | `WAITING_APPROVAL` |
| HTTP deprovision without flags | DTO `Equals(true)` + controller check + use-case policy |
| Invent foreign success | Coordination signals only; `foreignPortsInvoked: false` |
| Commercial status mutation | Out of scope — never touched |

Permissions (migration 106): `platform:lifecycle:read|suspend|resume|deprovision|migrate|recover|history:read`.
