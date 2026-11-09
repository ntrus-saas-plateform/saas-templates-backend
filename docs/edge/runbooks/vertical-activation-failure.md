# Runbook — Vertical activation failure

## Symptoms
- Vertical stuck in CONFIGURING / READY_FOR_ACTIVATION.
- Keycloak Organization create failed; vertical must not be ACTIVE.

## Actions
1. Inspect vertical status and `keycloak_organization_id`.
2. Retry Organization create/link; persist mapping in Control Plane only after success.
3. Run readiness-check; activate only when checks pass.
4. Audit `vertical.activated` or failure reason.
