# P7.9 — Deactivate & Recovery

## Controlled deactivate

`RequestExperienceDeactivateUseCase`:

1. Load assignment; reject if missing.
2. Require bound `authorizationRowId` / `authorizationVersion` (fail-closed).
3. Revalidate P7.1 authorization.
4. Ensure / publish workflow definition `p79.experience.deactivate`.
5. Create + start workflow instance with idempotency; mark assignment `DEACTIVATING`.
6. Emit audit/outbox event `p7.experience.deactivate.requested`.

## Deactivate handler effects

`experience.deactivate`:

- Client registrations → `REVOKED`
- Domains → `DEACTIVATED` route/binding; ACTIVE TLS → `REVOKED`; VERIFIED ownership → `REVOKED`
- Application bindings → `REVOKED`
- Assignment → `DEACTIVATED`
- Deployment run `DEACTIVATE` + evidence

## Compensation from provision

On provision failure, the verify step’s compensation key is `experience.deactivate`. Non-deactivate handlers’ `compensate()` returns `WAITING_APPROVAL` until an explicit deactivate after ownership/TLS safety assessment.

## Recovery practices

- Fix validation / ownership / TLS issues, then **re-provision** with a new idempotency key rather than patching applied state in SQL.
- Re-bind domains via `POST /edge/experience/domains` when ownership tokens must be re-issued (PENDING challenge).
- On idempotent replay, inspect the existing workflow status before launching a new run.
- Do not treat deactivate as a commercial entitlement revoke — P5 remains the entitlement authority.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| 403 on provision/deactivate | Missing RBAC permission | Grant `platform:experience:deploy` |
| `AUTHORIZATION_FAILED` | P7.1 expired/revoked/missing | Refresh provisioning auth |
| `HOSTNAME_CONFLICT` | Hostname already bound | Choose another host or deactivate prior binding |
| `DOMAIN_OWNERSHIP_UNVERIFIED` | Custom domain not fully ACTIVE at verify | Complete ownership/TLS then re-provision |
| `PROVIDER_UNAVAILABLE` | Live executor not wired | Wire executor + restart workers |
| `SECRET_PLAINTEXT_FORBIDDEN` | Non-vault credential in manifest | Replace with `credentialRef` vault handle |
