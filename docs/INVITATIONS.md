# Invitations

## Security

- Invitation tokens are **hashed** at rest; raw token returned once on create.
- Short TTL (configurable `expiresInHours`).
- Rate limited via global throttler + idempotency on accept.

## Flows

### Create

`POST /api/v1/invitations` → `CreateInvitationUseCase`:

1. Inviter permissions ⊆ assigned roles/permissions (no escalation)
2. Store hashed token
3. Event `user.invited`

### Accept

`POST /api/v1/invitations/accept` → `AcceptInvitationUseCase`:

1. Validate token hash + status + expiry
2. Ensure tenant membership + application user
3. Grant organization membership
4. Keycloak user/org sync
5. Event `user.activated`

### Revoke

`DELETE /api/v1/invitations/:id` before acceptance.

## Feature flag

Gated by `features.invitations` (default enabled).

## Metrics

Invitation failures increment `identity_invitation_failures_total` (when wired in invitation controller on domain errors).

## Testing

E2E invitation flow: see `test/e2e/` and security cross-org specs.
