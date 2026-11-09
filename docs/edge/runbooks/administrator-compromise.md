# Runbook — Edge administrator compromise

## Immediate containment
1. Suspend administrator (`POST /api/v1/edge/administrators/:id/suspend`) with justification.
2. Revoke all workspace sessions for the administrator.
3. Revoke Keycloak sessions in `edge-admin` realm for the subject.
4. Revoke active delegations and emergency grants.
5. Record security events; notify EDGE_SECURITY_ADMIN.

## Do not
- Touch ERP `platform` realm users unless a separate ERP compromise is confirmed.
- Delete the administrator row (preserve audit history).
