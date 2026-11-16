# P7.9 — Deployment Engine

## Entry points

| HTTP | Permission | Workflow |
|------|------------|----------|
| `POST /edge/experience/assignments/:id/provision` | `platform:experience:deploy` | `p79.experience.provision` |
| `POST /edge/experience/assignments/:id/deactivate` | `platform:experience:deploy` | `p79.experience.deactivate` |

Each request carries actor, correlation id, and idempotency key. Duplicate keys return the existing workflow (idempotent replay). Assign creates the assignment row only; provision/deactivate launch P7.4.

## Provision steps (handlers)

1. `experience.validate_plan` — published profile (if set), applications array shape, optional checksum match.
2. `experience.bind_applications` — require published app + version; upsert ACTIVE bindings.
3. `experience.register_clients` — technical OIDC upsert; redirect/origin/domain checks; vault `credentialRef` only.
4. `experience.bind_domains` — hostname validation; ownership token; attested subdomain may auto-verify.
5. `experience.provision_tls` — only for ownership-VERIFIED domains; vault `certificate_ref`; activate route/binding.
6. `experience.verify_experience` — bindings/clients ACTIVE; custom domains fully ACTIVE; set assignment `READY` + applied checksum.

Compensation handler key on verify: `experience.deactivate`.

## Deactivate step

1. `experience.deactivate` — revoke clients, deactivate domains (route/TLS/ownership as applicable), revoke application bindings, set assignment `DEACTIVATED`.

## Live executor

`live-experience.executor.ts` bridges P7.4 worker invocations to the experience repository. Mutations are gated by:

- Optional `WorkflowLeasePort` fencing when wired.
- Fail-closed `revalidateBoundAuthorization` before every handler mutation.
- Durable redacted evidence (failure to persist evidence fails the step).

Handlers without a live executor return `PROVIDER_UNAVAILABLE` (no simulated success).

## Runs & evidence

Deployment runs record operations such as `DEPLOY`, `VERIFY`, `BIND_DOMAIN`, `PROVISION_TLS`, `REGISTER_CLIENT`, `REVOKE_CLIENT`, `DEACTIVATE` with outcome and observed state. Step evidence is append-only and redacted.
