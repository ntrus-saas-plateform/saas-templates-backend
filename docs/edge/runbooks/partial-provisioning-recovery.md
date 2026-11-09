# Runbook — Recovery after partial provisioning

## Scenarios
- Vertical created in DRAFT but Keycloak Organization missing.
- Invitation accepted in app but Keycloak user link incomplete.
- Membership ACTIVE without external org membership.

## Principles
1. Prefer recoverable workflow states over false success.
2. Idempotent retries.
3. Reconciliation classifies drift; safe auto-repair only removes stale grants; never invents access.
4. Complete with audit events before exposing workspace.
