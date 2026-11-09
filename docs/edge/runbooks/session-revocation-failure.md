# Runbook — Workspace session revocation failure

## Symptoms
- Membership/vertical/admin suspended but old tabs still succeed briefly.
- `POST .../workspaces/active/revoke` or revoke-all errors.

## Actions
1. Revoke sessions in Control Plane by administrator / membership / vertical.
2. Clear Redis authz cache for the administrator.
3. Confirm subsequent API calls with stale workspace cookie return 401/409.
4. If Keycloak SSO revoke also required for compromise, revoke IdP sessions in `edge-admin` realm separately from ERP.
