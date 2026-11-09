# Runbook — Keycloak `edge-admin` unavailable

## Symptoms
- Edge login (`/api/edge-auth/login`) fails or hangs.
- Invitation accept / membership Keycloak sync enters recoverable pending state.
- JWT validation against `EDGE_KEYCLOAK_JWKS_URI` fails.

## Immediate actions
1. Confirm ERP `platform` realm health separately — do **not** redirect Edge traffic to the ERP realm.
2. Check Keycloak container/process and `edge-admin` realm import.
3. Verify `EDGE_KEYCLOAK_ISSUER`, `EDGE_KEYCLOAK_JWKS_URI`, admin client credentials.
4. Do not mark verticals ACTIVE or invitations ACCEPTED while Identity Provider writes fail.

## Recovery
1. Restore Keycloak; confirm JWKS reachable.
2. Run Edge reconciliation (admin API) to detect drift — **never auto-grant** access.
3. Retry pending invitation / membership sync records.
4. Verify Edge Admin Console login and workspace switch.

## ERP isolation
ERP BFF (`edge_bff_session` / `platform` realm) must continue independently.
