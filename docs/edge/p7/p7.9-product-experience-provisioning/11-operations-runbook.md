# P7.9 — Operations Runbook

## Prerequisites

1. Migration **104** applied on control-plane DB.
2. P7.4 workers running with experience handlers registered and live executor wired.
3. P7.1 authorization rows valid for target tenants (`provisioningRequestId` ready).
4. Edge admin has appropriate `platform:experience:*` permissions.

## Day-2 flows

### Publish a new experience baseline

1. Create experience profile → publish (`expectedVersion`).
2. Create application with draft manifest → publish version.
3. Assign tenant with `provisioningRequestId` + validated `desiredManifest` (apps / clients / domains).
4. Optionally bind domains via `POST /edge/experience/domains` (ownership challenge for custom hosts).
5. Provision from API; watch workflow + runs/evidence until assignment `READY`.

### Domain ownership / TLS issues

1. Confirm hostname uniqueness and ownership status.
2. For custom domains, complete ownership verification before expecting TLS activation.
3. Re-provision after ownership is VERIFIED; do not manually set TLS ACTIVE in SQL.

### Emergency deactivate

1. Confirm P7.1 authorization is still valid.
2. `POST …/assignments/:id/deactivate` with a fresh idempotency key and reason tracked in ops notes.
3. Verify assignment `DEACTIVATED`, clients `REVOKED`, domains `DEACTIVATED`.

## Monitoring

- Workflow instances `workflow_type` `experience.provision` / `experience.deactivate` (definition codes `p79.experience.*`).
- Failed deployment runs (`outcome=FAILED`) and evidence error codes.
- Audit events `p7.experience.*`

## Do / Don't

| Do | Don't |
|----|-------|
| Use vault refs for `credentialRef` / cert handles | Paste client secrets into manifests |
| Revalidate via P7.1 before mutative ops | Bypass workflows with direct SQL updates |
| Treat clients as technical OIDC only | Manage business users/roles/orgs in Edge P7.9 |
| Keep P5 grants separate | Assume assignment expands entitlements |
