# Memberships

## Model

`OrganizationMembership` in control plane: user ↔ organization with `roles`, `permissions`, `status`.

Tenant admin roles (`tenant_admin`, etc.) trigger last-admin protection on revoke.

## Flows

### Grant

`POST /api/v1/memberships` → `GrantMembershipUseCase`:

1. Validate org + user
2. Create membership row
3. Outbox `membership.created`
4. Keycloak sync (add user to KC org)

### Revoke

`DELETE /api/v1/memberships/:id` → `RevokeMembershipUseCase`:

1. Load membership
2. **Transaction**: if last tenant admin → `FORBIDDEN`
3. Revoke row
4. Outbox `membership.revoked`
5. Keycloak sync (remove from KC org)

### Update roles

`PATCH /api/v1/memberships/:id` → updates roles/permissions + event.

## Authorization

Requires permissions `memberships:read|create|update|revoke`. Membership permissions merge into `AuthorizationService` for the active organization.

## Metrics

`identity_membership_changes_total{operation="grant|revoke"}` recorded on successful API calls.
